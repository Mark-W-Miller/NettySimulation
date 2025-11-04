# NettySimulation

NettySimulation is a Vite + TypeScript workspace for building the Netty figure‑eight simulator.  The
core logic lives under `src/` and is split into engine, simulation, DSL, and UI layers so that each
system can evolve independently.  The project now lives at the repository root using the familiar
open‑source layout:

```
dist/               # Production build output
docs/               # Additional documentation and design notes
dev/                # Local utility scripts (static server, etc.)
src/                # Application source (engine, ui, dsl, assets)
test/               # Test scaffolding
index.html          # Vite HTML entry point
package.json        # NPM configuration
vite.config.ts      # Vite build/serve config
```

## Getting Started

```bash
npm install
npm run dev      # launches the Vite dev server
```

For a production bundle:

```bash
npm run build
npm run preview  # optional: locally preview the production build
```

The bundled assets land in `dist/`, which can be served by any static host.  A lightweight Node
static server is provided in `dev/static-server.mjs` if you prefer a dependency‑free option:

```bash
node dev/static-server.mjs         # http://127.0.0.1:8080/index.html
```

## Runtime Logging

The UI includes a floating log viewer (Display tab → “Open Log Viewer”).  Logs are categorised and
can be filtered in real time.  Categories currently emitted:

- `init` – application start‑up
- `camera` – camera snaps (double‑click on an axis)
- `ui` – log window open/close events
- `error` – captured `console.error`, uncaught exceptions, and unhandled rejections (rendered in red)

The logging backend lives in `src/app/log/db.ts`.  Use the exported `log(category, message, options?)`
helper to record new events.

## Dev Utilities

- `dev/static-server.mjs` – tiny static file server (no dependencies)
- `docs/static-server.md` – legacy documentation for the standalone Babylon scaffold

## Contributing

1. Fork and clone the repository.
2. Run `npm install` and `npm run dev`.
3. Keep TypeScript definitions and formatting tidy.
4. Open a PR with a concise description of the change.
