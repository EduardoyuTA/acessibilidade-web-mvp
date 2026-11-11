# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Design decisions (redesign "Sinal claro", 2026-11)

Source of truth: Claude Design canvas "AcessoClaro — Redesign" (desktop, mobile and motion boards). All styles live in `src/styles.css` (tokens on `:root`).

- Type: Atkinson Hyperlegible Next (UI) and Atkinson Hyperlegible Mono (code), self-hosted via `@fontsource` — no third-party font requests.
- Color: ground `#f4f6fa`, white cards, brand blue `#1e56cf`, green `#0e7a4f`, accent `#2bd08f`. Text contrast ≥ 4.5:1; severity uses a colored side stripe plus a text badge.
- Layout: steps are a horizontal stepper above the content (no side rail). On ≤ 720px the main navigation is a fixed bottom bar; don't add `backdrop-filter` to `.topbar` at that width (it traps the fixed bar inside the header).
- Motion: 150 ms (state), 220 ms (open/close), 320 ms (screen enter, 40 ms stagger), 700–900 ms (charts); easing `cubic-bezier(.2,.8,.2,1)`. Everything collapses under `prefers-reduced-motion`.
- Accessibility: touch targets ≥ 44px; icon-only or shortened labels keep the full name for screen readers; run axe on every screen after visual changes (zero violations at 375px and 1366px).
