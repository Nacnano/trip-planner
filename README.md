# Trip Planner

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

The app uses a shared PostgreSQL database hosted on [Supabase](https://supabase.com) through Prisma, so every user sees the same trips and spending data.

## Getting Started

First, copy the example env file and add your Supabase connection string:

```bash
cp .env.example .env.local
```

Then set `SUPABASE_DATABASE_URL` to the Supabase **Session pooler** connection string from your project settings. For this app, Prisma db push should use the pooler on port `5432`. The same value can also be used for `DATABASE_URL` if you prefer the Prisma default name.

Create the shared table in Supabase before running the app:

```bash
npx prisma db push
```

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load locally selected Google fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase Notes

- Create a new Supabase project and copy the **Session pooler** PostgreSQL connection string on port `5432` into `.env.local`.
- Run `npx prisma db push` once to create the `AppSnapshot` table in the hosted database.
- If you change the Prisma schema later, rerun `npx prisma db push` or switch to migrations.
