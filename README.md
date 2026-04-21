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
