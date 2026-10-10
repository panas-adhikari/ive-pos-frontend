# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

# API data cache

The frontend shares API responses through the React Query provider in `src/api-cache.ts`.
Identity is refreshed after one minute, organization and platform data after five minutes,
and authentication capabilities after thirty minutes. Data is retained in memory while
the app is open, including across workspace navigation. Refresh buttons fetch immediately,
and writes invalidate the affected query keys. Signing out or changing sessions clears
cached account data. The cache is not persisted to browser storage.


## Hosted build

Set `VITE_API_URL=https://api.your-domain` at build time; it is public configuration.
Leave it blank for the local Vite proxy. `npm ci && npm run build` produces `dist/`,
including a Pages `404.html` app shell, `.nojekyll`, and optional `CNAME` from
`PAGES_CUSTOM_DOMAIN`. Assets assume a custom domain served at `/`.

The application selects screens through React state, with no URL router. Direct nested
URLs and refresh load the app shell/default workspace; they do not map to individual screens.
Pages returns HTTP 404 for fallback paths; a static host with rewrites can return HTTP 200.

The workflow in `.github/workflows/pages.yml` builds `main` and pull requests. Set repository
variables `VITE_API_URL` and `PAGES_CUSTOM_DOMAIN`. `ENABLE_PAGES=true` enables deployment
on main only. Configure GitHub Pages' source as Actions, set the custom domain in repository
settings and DNS, and enforce HTTPS. Never put secrets in `VITE_*`.

GitHub Pages' published limits exclude commercial SaaS and discourage password transactions:
https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
Use the backend VM's Caddy static host or an appropriate static provider for real users.
Both app and API must use HTTPS sibling subdomains for the existing secure cookie model.

The complete deployment, backup/restore, and future AWS migration runbook is
`deploy/README.md` in the separate backend repository (`../backend/deploy/README.md`
in this workspace). Its Caddy configuration serves the same `dist/` artifact.

Hosted artifact smoke test (mocked API, no database writes):

```sh
VITE_API_URL=https://api.example.com npm run build
npx playwright install chromium
node scripts/check-hosted.mjs
```

## Local subdomains

Run `npm run dev`. Open `http://www.localhost:5173` for marketing and
`http://app.localhost:5173/login` for sign-in. The same Vite server serves both.
Development marketing links keep the current Vite port and use `app.localhost`;
registered workspaces use `<slug>.localhost`. Configure the backend with
`APP_ENV=development`, `PUBLIC_ORIGIN=http://app.localhost:5173`, and
`TENANT_BASE_DOMAIN=localhost`. Restart the backend after changing these settings.
Production builds use `VITE_APP_LOGIN_URL` (default `https://app.ivepos.me/login`)
and `VITE_TENANT_BASE_DOMAIN` (default `ivepos.me`), including prerendered pages.

## Vercel production settings

Use build command `npm run build` and output directory `dist`. Configure:

```dotenv
VITE_APP_LOGIN_URL=https://app.ivepos.me/login
VITE_PUBLIC_SITE_URL=https://www.ivepos.me
VITE_TENANT_BASE_DOMAIN=ivepos.me
VITE_API_URL=https://YOUR-RENDER-API-ORIGIN
```

Set these on the production environment and rebuild after changes. Add
`www.ivepos.me` and `app.ivepos.me` to the matching frontend project(s); deploy the
branch containing these changes or merge it into the configured production branch.
Registered organization URLs additionally need wildcard domain/DNS/TLS routing.
The included `api/proxy.mjs` function and `/api/:path*` rewrite provide the same-origin
API connection to Render. Set server-side `API_PROXY_ORIGIN=https://api.ivepos.me`
(the default) or the exact HTTPS backend origin. Keep
`VITE_TENANT_BASE_DOMAIN=ivepos.me` and `VITE_APP_LOGIN_URL=https://app.ivepos.me/login`
available to the Vercel function as well as the build. The backend needs
`PUBLIC_ORIGIN=https://app.ivepos.me` and `TENANT_BASE_DOMAIN=ivepos.me`.

The proxy supplies the original workspace origin for reads, verifies the actual
origin and CSRF header on writes, and keeps session cookies on the workspace host.
Unknown organizations still return the backend's 404. No database or authentication
secrets belong in this frontend project. `VITE_API_URL` is intentionally ignored on
organization hosts. Deploy from this repository with its `api` directory and
`vercel.json`, rather than uploading only `dist`. Verify the deployed routing with
`https://atharva.ivepos.me/api/v1/public/site`: it must return JSON for Atharva
Organization, even without a browser Origin header. A Vercel text/HTML 404 means
the proxy function/rewrite hasn't been deployed. Run proxy regressions with
`node tests/api-proxy.test.mjs`.

## Organization administrator password recovery

Platform super admins can reset an organization's administrator password from its
detail page under Platform controls. Confirm the target email, verify your admin
identity, and copy the generated temporary password from the result dialog.
Existing sessions are signed out, MFA is preserved, and the administrator must
change the temporary password at next login. The dialog also offers the existing
email delivery option. Closing it removes the password from the screen; passwords
are not retained in browser storage or query caches. This requires the matching
backend password-reset endpoint and no database migration.

## Workspace navigation

Workspace screens use browser paths: `/overview`, `/organizations`,
`/organizations/<id>`, `/organizations/new`, `/platform/users`, `/profile`,
`/terminal`, `/inventory`, `/reports`, `/stores`, `/people`, `/settings`, and
`/setup`. `/platform` aliases `/overview`; `/app`, `/login`, and the app-host root
open the account's permitted default screen. A valid session skips the login form;
an expired access cookie is refreshed before requiring sign-in. Signed-out deep
links retain a local, role-checked `next` destination. Required password changes
and email-link flows still take precedence over workspace entry.

Deploy the included `vercel.json` with the frontend so direct visits and refreshes
serve the application shell for workspace routes. It leaves marketing pages and
assets available and routes `/api` requests through the dedicated proxy. Other
static hosts need the same SPA fallback and their own API reverse proxy. Workspace
navigation itself needs no backend environment change or database migration.
Run the mocked browser regression checks with
`npx playwright test --config playwright.session.config.ts navigation.spec.ts`.

### Organization settings

`/settings` groups business details, contact and branding, regional defaults, and receipt defaults in one editable form. It includes live logo and sample receipt previews, the organization's dedicated or shared sign-in address, copy/open controls, a Profile & Security shortcut, store usage and employee allowances, and store capacity requests. Changes use the existing versioned settings endpoint and organization action verification. Failed saves retain edits; discard and explicit reload controls restore saved values. Unsaved edits prompt before leaving through workspace navigation or switching organizations, and before closing or reloading the browser tab. Timezone and receipt footer defaults apply to new stores; existing stores retain their settings. No database migration or additional hosting configuration is required.
