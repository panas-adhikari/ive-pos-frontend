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
