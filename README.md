# The Fursuit Database (Wiki-Style Node.js App)

A Wikipedia-style directory for cataloging fursuits with:

- **Node.js + Express**
- **PostgreSQL + Prisma ORM**
- **Clerk** for authentication/session management
- **EJS** templates for server-rendered pages

## Features Implemented

- Public wiki directory of fursuits (`GET /`)
- Individual fursuit pages (`GET /fursuit/:id`)
- Auth-protected add form and submission (`GET /add`, `POST /add`)
- Auth-protected claiming endpoint (`POST /fursuit/:id/claim`)
- Owner status model (`isClaimed`, `ownerId`) linked to Clerk user IDs
- Search/filter on homepage (`q`, `style` query params)

## Project Structure

```text
.
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.js
│   ├── public/
│   │   └── css/styles.css
│   └── views/
│       ├── add.ejs
│       ├── fursuit.ejs
│       ├── index.ejs
│       ├── sign-in.ejs
│       └── partials/
│           ├── footer.ejs
│           └── head.ejs
├── package.json
└── .env.example
```

## Step-by-Step Setup (Exact Commands)

```bash
# 1) Initialize project
npm init -y

# 2) Install dependencies
npm install express ejs dotenv @clerk/express @prisma/client
npm install -D prisma nodemon

# 3) Initialize Prisma for PostgreSQL
npx prisma init --datasource-provider postgresql

# 4) Generate Prisma client + run migration
npx prisma migrate dev --name init_fursuit_model
npx prisma generate

# 5) Start app
npm run dev
# or
npm start
```

## Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
CLERK_PUBLISHABLE_KEY="your_real_clerk_publishable_key"
CLERK_SECRET_KEY="your_real_clerk_secret_key"
PORT=3000
```

## Required Routes

- `GET /` — homepage with recent fursuits + search/filter
- `GET /fursuit/:id` — fursuit wiki page
- `GET /add` — add form (Clerk-protected)
- `POST /add` — create fursuit (Clerk-protected)
- `POST /fursuit/:id/claim` — claim unclaimed fursuit (Clerk-protected)

## Fursuit Prisma Model

```prisma
model Fursuit {
  id          Int      @id @default(autoincrement())
  name        String
  species     String?
  maker       String?
  style       String?
  description String?  @db.Text
  isClaimed   Boolean  @default(false)
  ownerId     String?
  addedBy     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Clerk UI in Templates

The EJS templates include Clerk frontend script setup and UI control tags:

- `<SignedOut>...</SignedOut>`
- `<SignedIn>...</SignedIn>`
- `<UserButton />` (with mounted `#user-button`)

`head.ejs` includes Clerk script tag and `footer.ejs` handles signed-in/signed-out visibility + user button mounting.
