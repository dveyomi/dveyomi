# Personal Finance OS

A personal budgeting web app for David and a few friends and family: an income-first monthly budget
(Needs, Wants and savings), safe to spend per day, expenses with a calendar and analytics, savings funds,
recurring payments, trips, CSV/Excel import and a period-end review. Mobile-first, with a designed
desktop layout, light and dark themes, and Google sign-in.

- **Stack:** Next.js 16 (App Router, `src/proxy.ts`), React 19, Tailwind CSS v4 (tokens in
  `src/design/tokens.css`, shared pieces in `src/components/ui`), Supabase (Postgres with row-level
  security on every table, Auth, pg_cron, Vault).
- **Where things are:** every figure is worked out in `src/lib/calc` (money is integer pence, dates are
  `YYYY-MM-DD`); `src/lib/data` reads and writes through Supabase; the schema and database functions are
  the migrations in `supabase/migrations` (0001 to 0011). The product design is
  `docs/superpowers/specs/2026-11-20-personal-finance-os-design.md`; start with `docs/START-HERE.md`.

## Local setup

Needs Node 22+, npm and Docker.

1. Start Docker if it isn't running (in a container or VM without a service manager: `sudo dockerd &`).
2. Install and start the local Supabase stack (applies every migration):

   ```bash
   npm install
   SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start
   ```

3. Copy `.env.example` to `.env.local` and fill it from `npx supabase status -o env`
   (`API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`), plus any long random `CRON_SECRET`. For Google
   sign-in locally, also set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `_SECRET` (read by
   `supabase/config.toml`) and restart the stack.
4. `npm run dev` and open http://localhost:3000.

To start the database again from the migrations: `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase db reset`.

## Tests

```bash
npm test           # unit and component tests (Vitest, jsdom)
npm run test:db    # *.db.test.ts against the local stack (refuses any URL but http://127.0.0.1:<port> / http://localhost:<port>)
npm run test:e2e   # Playwright end-to-end tests against a local build and the local stack
npm run lint
npm run build
```

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
privacy page says backups are kept by the database provider, so this must be on.

## Deploy checklist

Supabase (hosted project, in an EU or UK region):

- [ ] `npx supabase link --project-ref <ref>`, then `npx supabase db push` to apply every migration,
      `0001_schema.sql` through `0011_final.sql`, in order.
- [ ] Database → Extensions: `pg_cron` and `pg_net` are enabled (0007 enables them where available).
- [ ] The hourly job exists: `select * from cron.job;` lists `recurring-payments` (`0 * * * *`).
- [ ] Vault secrets `app_url` (the production URL) and `cron_secret` (see "Recurring payments" above).
- [ ] Auth → Providers: **Google** enabled with the client ID and secret from Google Cloud; the Google
      client keeps Supabase's own callback, `https://<project>.supabase.co/auth/v1/callback`.
- [ ] Auth → Providers: **Email** disabled, and new sign-ups only through Google (Auth → Sign In / Up).
- [ ] Auth → URL Configuration: Site URL = the production URL; redirect URLs include
      `https://<your app>/auth/callback` and the Vercel previews, e.g. `https://*-<team>.vercel.app/auth/callback`.
- [ ] Backups: daily backups on, and Point-in-Time Recovery if the plan allows it (see "Backups").

Vercel:

- [ ] Environment variables, per environment (Production and Preview):
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: set **before the build**, because
    `NEXT_PUBLIC_` values are inlined at build time (redeploy after changing them);
  - `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`: server-only, never `NEXT_PUBLIC_`. Only
    `src/lib/supabase/admin.ts` (marked `server-only`) reads the service-role key, for the hourly
    recurring job and account deletion; `CRON_SECRET` must equal the Vault `cron_secret`.
- [ ] Every response carries `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`
      (`next.config.ts`); check with `curl -sI https://<your app>/login`.

After each deploy:

- [ ] Sign in with Google on the deployed URL (and on a preview URL): the round trip lands on the Budget
      tab or onboarding, and signing out returns to the login page.
- [ ] Run the end-to-end tests against the preview URL: `E2E_BASE_URL=https://<preview> npm run test:e2e`.
      The tests create and sign in users through the local stack only (they refuse any other Supabase
      URL), so this needs a preview built with the local stack's `NEXT_PUBLIC_SUPABASE_*` values; for a
      preview on the hosted project, the manual Google round trip above is the check.
- [ ] Check the hourly job's last run: `select * from cron.job_run_details order by start_time desc limit 5;`.
