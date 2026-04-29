# Legacy Code

This folder contains the old web/API-first implementation that predates the current desktop local-first architecture.

Why it is still here:

- to preserve migration context for a short period
- to compare old UX flows while rebuilding features
- to keep old remote/cloud assumptions visible until a real remote mode is redesigned

What it is not:

- part of the active runtime path for the current desktop app
- the planned foundation for future remote mode
- a stable public API surface

Current rule:

- active product code should live outside `src/legacy`
- files in `src/legacy` may be referenced for ideas, but new work should not build on them directly

Long-term direction:

- either remove this folder entirely
- or replace it with a dedicated remote-mode implementation once that architecture is real
