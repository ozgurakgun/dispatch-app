# Dispatch App (v1)

Restaurant dispatch simulation app for Great Western Rd, Glasgow.

## Features

- OpenStreetMap map view centered on the restaurant.
- Incoming orders generated from within a configurable mile radius.
- Simple assignment algorithm: first available driver gets the next pending order.
- Live status of drivers, open orders, and delivered history.
- Render-oriented GitHub workflow (`.github/workflows/render_workflow.yml`) for:
  - PR validation (`lint` + `build`)
  - Optional deployment trigger on `main` with `RENDER_DEPLOY_HOOK_URL` secret

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173` (or the port shown by Vite).

## Local Build Check

```bash
npm run lint
npm run build
```

## Deployment on Render

Static Vite app: publish the `dist` folder after `npm run build`.

1. In [Render](https://dashboard.render.com), create a **Static Site** and connect this GitHub repository (or use **Blueprints** and point at `render.yaml` in the repo).
2. Use **Build command:** `npm ci && npm run build` and **Publish directory:** `dist`.
3. Optional: open the service **Settings → Build & Deploy → Deploy Hook**, create a hook, then add it to GitHub as repository secret **`RENDER_DEPLOY_HOOK_URL`** so pushes to `main` can trigger a deploy via `.github/workflows/render_workflow.yml`.

## Contributor / agent workflow

See [`workflow.md`](workflow.md) for PR comments (prompt audit trail), commit style, and CI expectations.
