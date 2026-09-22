# Plant Development Instructions

When working in Plant, read `/AGENTS.md`, `/.normex/CURRENT-STATUS.md` and `/.normex/PLANT.md`. Read `/.normex/ROADMAP.md` when sequencing matters. Do not automatically open large `docs/architecture` files; use them only when deeper architecture clarification is needed.

Current goal: complete all Plant submenu workspaces to MVP. Do not repeatedly redesign completed Overview or Fleet. Each submenu has a distinct operational purpose. Do not copy Overview summaries into domain pages.

A Plant domain page should provide detailed records, filtering, workflow actions, appropriate editing, history, evidence and deeper domain-specific tools. For example, Compliance owns detailed compliance control; Defects owns defects, restrictions, repair flow, downtime, actions and history.

Prioritise useful purpose, professional UI, understandable workflows, fast navigation, scalable tables/lists and restrained useful charts. Avoid decorative complexity.

Use light UI checks during iteration. Use targeted correctness checks for Plant writes and state transitions. Do not create large automated suites while pages are still changing.

## Approved UI ownership

When a Plant page's HTML/CSS are approved, preserve their composition, styling, hierarchy and copy. Populate and control the existing DOM from JavaScript; add only minimal hooks where required. Do not redesign approved Plant UI unless explicitly asked.
