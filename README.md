# Proxy Dashboard - Cloudflare Worker

A Cloudflare Worker that generates password-protected proxy links for `.m3u` and `.m3u8` URLs, with optional expiry and a D1-backed password setting.

## One-click deploy

1. Upload this project to a **public GitHub or GitLab repo**.
2. Replace `<YOUR_PUBLIC_REPO_URL>` in the button below with your repo URL.
3. Click the button and complete the Cloudflare wizard.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/smokindope/proxy-with-tokens-and-pass-1-click)

Cloudflare reads `wrangler.jsonc`, creates the Worker, and provisions the D1 binding named `DB`.

## First run

Open your deployed Worker URL:

```text
https://<worker-name>.<your-workers-subdomain>.workers.dev
```

The default password is:

```text
change-me-now
```

Use the **Change Password** form immediately after deploying.

## Local development

```bash
npm install
npm run dev
```

## Manual deploy alternative

```bash
npm install
npx wrangler d1 create proxy_dashboard
```

Copy the generated `database_id` into `wrangler.jsonc`, replacing:

```text
00000000-0000-0000-0000-000000000000
```

Then run:

```bash
npm run deploy
```

The Worker also creates the `settings` table automatically on first request, so the SQL migration is included mainly for versioned/manual D1 setup.

## Files

```text
src/index.js                 Worker source
wrangler.jsonc               Cloudflare Worker + D1 config
migrations/0001_settings.sql D1 schema
package.json                 Wrangler scripts
```
