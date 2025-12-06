# How to Run NettySimulation

Simple steps to get the simulator running locally (dev or built bundle).

## Prerequisites
- Node.js 18+ (LTS recommended)
- npm (ships with Node)

## Install dependencies
```bash
npm install
```

## Run the dev server
```bash
npm run dev
# Vite will print the local URL (default http://127.0.0.1:5173/)
```

## Build for production
```bash
npm run build
```
The bundled files land in `dist/`.

### Preview the build with Vite
```bash
npm run preview
# Serves the built assets (defaults to http://127.0.0.1:4173/)
```

### Serve the build with the lightweight static server
If you prefer a dependency‑free static host:
```bash
node dev/static-server.mjs
# http://127.0.0.1:8080/index.html
```
