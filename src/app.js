require('dotenv').config();

const path = require('path');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { clerkMiddleware, getAuth, requireAuth } = require('@clerk/express');

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 3000);
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || '';
const secretKey = process.env.CLERK_SECRET_KEY || '';
const isClerkConfigured =
  (publishableKey.startsWith('pk_test_') || publishableKey.startsWith('pk_live_')) &&
  (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_'));
const authRequired = isClerkConfigured
  ? requireAuth()
  : (req, res) =>
      res
        .status(503)
        .send(
          'Authentication is unavailable. Configure CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in your .env file.',
        );

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
if (isClerkConfigured) {
  app.use(clerkMiddleware());
} else {
  // eslint-disable-next-line no-console
  console.warn(
    'Clerk keys are missing or placeholders. Auth routes are disabled until valid keys are set.',
  );
}

app.use((req, res, next) => {
  res.locals.clerkPublishableKey = publishableKey;
  res.locals.clerkEnabled = isClerkConfigured;
  res.locals.auth = isClerkConfigured ? getAuth(req) : { userId: null };
  next();
});

app.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const style = (req.query.style || '').trim();

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { species: { contains: q, mode: 'insensitive' } },
            { maker: { contains: q, mode: 'insensitive' } },
            { style: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(style ? { style: { equals: style, mode: 'insensitive' } } : {}),
  };

  try {
    const [fursuits, styles] = await Promise.all([
      prisma.fursuit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.fursuit.findMany({
        distinct: ['style'],
        select: { style: true },
        where: { style: { not: null } },
        orderBy: { style: 'asc' },
      }),
    ]);

    return res.render('index', {
      fursuits,
      styles: styles.map((entry) => entry.style).filter(Boolean),
      filters: { q, style },
      error: null,
    });
  } catch (error) {
    return res.status(500).render('index', {
      fursuits: [],
      styles: [],
      filters: { q, style },
      error:
        'Could not load fursuits yet. Check your DATABASE_URL and run Prisma migrations.',
    });
  }
});

app.get('/fursuit/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(404).send('Fursuit not found');
  }

  const fursuit = await prisma.fursuit.findUnique({ where: { id } });

  if (!fursuit) {
    return res.status(404).send('Fursuit not found');
  }

  return res.render('fursuit', {
    fursuit,
    notice: req.query.notice || null,
    error: req.query.error || null,
  });
});

app.get('/add', authRequired, (req, res) => {
  return res.render('add', {
    values: {
      name: '',
      species: '',
      maker: '',
      style: '',
      description: '',
    },
    error: null,
  });
});

app.post('/add', authRequired, async (req, res) => {
  const { userId } = getAuth(req);
  const { name, species, maker, style, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).render('add', {
      values: { name, species, maker, style, description },
      error: 'Name is required.',
    });
  }

  const created = await prisma.fursuit.create({
    data: {
      name: name.trim(),
      species: species?.trim() || null,
      maker: maker?.trim() || null,
      style: style?.trim() || null,
      description: description?.trim() || null,
      addedBy: userId,
    },
  });

  return res.redirect(`/fursuit/${created.id}?notice=Fursuit added successfully.`);
});

app.post('/fursuit/:id/claim', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const { userId } = getAuth(req);

  if (!Number.isInteger(id)) {
    return res.status(404).send('Fursuit not found');
  }

  const claimResult = await prisma.fursuit.updateMany({
    where: {
      id,
      isClaimed: false,
      ownerId: null,
    },
    data: {
      isClaimed: true,
      ownerId: userId,
    },
  });

  if (claimResult.count === 0) {
    return res.redirect(`/fursuit/${id}?error=This fursuit has already been claimed.`);
  }

  return res.redirect(`/fursuit/${id}?notice=You claimed this fursuit.`);
});

app.get('/sign-in', (req, res) => {
  return res.render('sign-in', { clerkEnabled: isClerkConfigured });
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
