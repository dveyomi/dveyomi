This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Recurring payments: the hourly job

Recurring payments are added by an hourly pg_cron job (migration `0007_recurring.sql`) that POSTs to
`/api/cron/recurring`, and again whenever a signed-in user opens the app. The job reads two secrets from
Supabase Vault and does nothing until both exist, so local and preview databases never call out.

At deploy:

1. Choose a long random secret, e.g. `openssl rand -hex 32`.
2. Set the app's server environment variables (never `NEXT_PUBLIC_`):
   - `CRON_SECRET`: that secret;
   - `SUPABASE_SERVICE_ROLE_KEY`: the project's service-role key (the route adds payments for every user).
3. Store the app's URL and the same secret in the project's Vault (SQL editor):

   ```sql
   select vault.create_secret('https://your-app.example.com', 'app_url');
   select vault.create_secret('<the secret>', 'cron_secret');
   ```

   To change one later: `select vault.update_secret(id, '<new value>') from vault.secrets where name = 'cron_secret';`

The route answers 401 unless the request carries `Authorization: Bearer <CRON_SECRET>`. Check runs with
`select * from cron.job_run_details order by start_time desc limit 5;` and the responses with
`select * from net._http_response order by created desc limit 5;`.

## Backups

Turn on backups for the hosted Supabase project before real data goes in: daily backups (Database →
Backups), and Point-in-Time Recovery if the plan allows it. This is a project setting, not code. The
privacy page tells users daily backups are kept.

## Deploy checklist

- **Environment variables** (server): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- **Service role stays on the server.** `SUPABASE_SERVICE_ROLE_KEY` is never `NEXT_PUBLIC_`; only
  `src/lib/supabase/admin.ts` (marked `server-only`) reads it, for the hourly recurring job and for
  account deletion (`POST /api/account/delete`).
- **Vault secrets** `app_url` and `cron_secret` (see "Recurring payments: the hourly job" above).
- **Google OAuth redirect URLs:** in Supabase Auth → URL Configuration, set the Site URL to the app's URL
  and add `https://<your app>/auth/callback` to the redirect allow list (plus any preview URLs); the
  Google client in Google Cloud keeps Supabase's own callback, `https://<project>.supabase.co/auth/v1/callback`.
- **Backups** on (see above).
- **Region:** create the project in an EU or UK region.
