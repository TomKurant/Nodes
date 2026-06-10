# Nodes — Graph Editor Project

## What this project is

A browser-based interactive node graph editor built in vanilla HTML/CSS/JS. It lets users create, visualize, and navigate interconnected nodes — aimed at mapping data estates (Microsoft Fabric metadata, schema relationships, pipelines) as a living ontology/anthology.

**Entry points:**
- `index.html` — main menu, graph selection, theme picker
- `graph.html` — the graph editor canvas
- `js/graph-editor.js` — core graph logic (force-directed layout, node/edge rendering)
- `js/node.js` — node model and behavior
- `js/link.js` — edge/link model
- `js/storage.js` — save/load graphs as JSON
- `js/converter.js` — import from draw.io XML / Fabric snapshots
- `css/` — base, editor, menu, themes stylesheets
- `graphs/` — saved graph JSON files
- `XML schemas/` — draw.io import samples
- `Images/` — logos and screenshots
- `Ideas.txt` — feature backlog and long-term vision
- `convert_snapshot.py` — Python helper to convert Fabric metadata snapshots

## GitHub repository

`https://github.com/TomKurant/Nodes` (branch: `main`)

A **Stop hook** in `.claude/settings.local.json` automatically runs `git add -A && git commit && git push` at the end of every Claude task. This means the repo is always up to date without manual intervention.

## Git workflow rules

- **Auto-commits** (from the Stop hook) use the format: `auto: YYYY-MM-DD HH:MM - save changes`
- **Manual commits** (for features/fixes) must use a clear imperative message: `add radial layout mode`, `fix node drag on touch`, `refactor storage to use IndexedDB`
- Never commit `.claude/settings.local.json` (it is gitignored — personal settings only)
- Never commit `tmpclaude-*` temp files (also gitignored)
- Keep commits atomic: one logical change per commit when doing manual work
- Before starting a significant feature, check `git status` and commit any pending changes first

## Coding conventions

- Vanilla JS only — no frameworks, no build step
- Files are loaded directly in the browser (`<script src="...">`) — keep ES module-style separation but without `import/export`
- CSS custom properties (variables) for all theme colors — never hardcode colors
- Graph data format: JSON with `{ nodes: [...], links: [...] }` structure

## Feature backlog (from Ideas.txt — implement progressively)

**Graph intelligence:** community detection (Louvain), merge graphs, fabric-specific node shapes, import from Fabric metadata API, link type styles  
**Layout modes:** radial (selected node center), hierarchical (by depth), alongside existing force-directed  
**Interaction:** grid snap, auto-arrange selection, subgraph extraction  
**Export:** draw.io export, JSON-LD/RDF  
**Anthology features:** timeline slider, provenance tracking, cross-graph references, node metadata panel, versioning/snapshots

## How to work on this project

1. Check `git log --oneline -10` at the start of a session to understand recent changes
2. Read `Ideas.txt` for the long-term vision before suggesting features
3. Test changes by opening `index.html` or `graph.html` directly in a browser
4. After any meaningful feature addition, write a descriptive manual commit — do not rely solely on the auto-commit
5. Keep `Ideas.txt` updated when new ideas come up or backlog items are completed
6. Update this CLAUDE.md whenever the project structure, conventions, or workflow changes significantly
