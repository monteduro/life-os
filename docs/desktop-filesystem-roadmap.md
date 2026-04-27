# Desktop Filesystem Roadmap

Last updated: 2026-04-23

## Locked Decisions

- Desktop target: `Tauri`
- Canonical note format: `Markdown + YAML frontmatter`
- Primary editor: `TipTap` for the note body
- Local index: `SQLite`
- Vault contents: user files only (`.md` + attachments)
- Templates: stored outside the vault, in app data

## Product Direction

The app is moving from:

- backend-first SPA
- auth-gated access
- REST API as source of truth

To:

- desktop local-first app
- user-selected folder as vault
- Markdown files as source of truth
- SQLite as performance/index layer
- templates as app-level schema/rendering, not vault config

## Target Architecture

### Layers

1. `Vault layer`
   Reads and writes folders, markdown files, attachments, moves, deletes, and file watcher events.
2. `Index layer`
   Keeps a SQLite index in sync with the vault and serves fast queries.
3. `Template layer`
   Loads template JSON from app data, resolves note presentation and structured fields.
4. `Editor layer`
   Uses TipTap for the markdown body and a separate properties model for frontmatter data.

### Planned Modules

```text
src/core/vault/
  types.ts
  vaultRepository.ts
  vaultWatcher.ts
  markdownDocument.ts

src/core/index/
  indexRepository.ts
  indexer.ts
  searchService.ts

src/core/templates/
  templateRegistry.ts
  templateTypes.ts
  templateResolver.ts

src/features/documents/
  useDocuments.ts
  useDocument.ts
  useSaveDocument.ts
  useFolderTree.ts
  useSearchDocuments.ts

src/desktop/
  tauriClient.ts
  commands.ts
```

## Current Codebase Touchpoints

These are the main files to migrate first:

- `src/App.tsx`
  Replace auth bootstrap with vault bootstrap.
- `src/api/client.ts`
  Stop using HTTP as the core data transport.
- `src/api/notesApi.ts`
  Replace REST-backed note hooks with vault/index-backed hooks.
- `src/api/foldersApi.ts`
  Replace folder CRUD with filesystem tree operations.
- `src/components/layout/Sidebar.tsx`
  Feed the tree from the filesystem/index instead of `/folders`.
- `src/components/editor/NoteEditor.tsx`
  Keep TipTap, but move mentions and related lookup to the local index.

## Task List

### Phase 0: Foundations

- [ ] Create the Tauri shell and verify the current React/Vite app runs inside it.
- [x] Add a dedicated `docs/` roadmap and keep it updated as the migration proceeds.
- [ ] Define the initial vault contract:
  - root folder selected by the user
  - recursive folder tree
  - markdown files as notes
  - attachments preserved as-is
- [ ] Define the canonical markdown document shape:
  - YAML frontmatter
  - markdown body
  - stable note ID strategy
- [ ] Decide where app data lives on disk:
  - SQLite DB
  - template registry
  - local app settings

### Phase 1: Desktop Bootstrap

- [x] Add Tauri configuration and local dev scripts.
- [x] Implement `Open Folder` and persist the last opened vault path.
- [x] Replace the auth-first app bootstrap in `src/App.tsx` with:
  - vault picker
  - recent vault loader
  - loading state for initial scan/index
- [ ] Remove or isolate auth flows so they do not block the new local app flow.
- [x] Add a basic desktop error surface for filesystem permission failures.

### Phase 2: Vault Layer

- [x] Create `src/core/vault/types.ts` for local document and folder types.
- [ ] Implement `vaultRepository.ts` with:
  - `scanVault`
  - `readDocument`
  - `saveDocument`
  - `createDocument`
  - `moveDocument`
  - `deleteDocument`
  - `listFolders`
- [ ] Implement safe path normalization and path-based guards.
- [ ] Add attachment helpers for copy/import into the vault.
- [ ] Add filesystem watcher support for external changes.

### Phase 3: Markdown Canonical Format

- [ ] Add a markdown parser/serializer module in `src/core/vault/markdownDocument.ts`.
- [ ] Support YAML frontmatter read/write.
- [ ] Define the initial frontmatter keys:
  - `id`
  - `title`
  - `template`
  - `created_at`
  - `updated_at`
  - `tags`
- [ ] Map markdown body to the current TipTap editor model.
- [ ] Map TipTap output back to canonical markdown.
- [ ] Define fallback behavior for malformed frontmatter or unsupported markdown content.

### Phase 4: SQLite Index

- [ ] Add SQLite integration in the Tauri layer.
- [ ] Create the initial schema:
  - `documents`
  - `folders`
  - `document_links`
  - `document_tags`
  - `search_fts`
- [ ] Implement an initial full-vault indexing pass.
- [ ] Store content hash and last indexed timestamp per file.
- [ ] Implement incremental re-indexing from watcher events.
- [ ] Add full-text search queries for fast filtering and global search.
- [ ] Add index health/rebuild commands.

### Phase 5: Frontend Data Migration

- [ ] Introduce local repository-backed hooks under `src/features/documents/`.
- [ ] Keep TanStack Query, but swap HTTP query functions for local repository calls.
- [ ] Replace `useNotes` with a local documents hook.
- [ ] Replace `useFolders` with a folder tree hook backed by the vault/index.
- [ ] Remove the direct dependency on `src/api/client.ts` from note and folder flows.
- [ ] Decide whether legacy API modules stay temporarily under a compatibility layer or get removed early.

### Phase 6: UI Migration

- [ ] Update `Sidebar.tsx` to render the real filesystem tree.
- [ ] Update `AppLayout.tsx` header to show the selected folder/path instead of authenticated user state.
- [ ] Update `NoteList.tsx` to read documents from the local layer.
- [ ] Update `NoteInline.tsx` create/save flows to write markdown files locally.
- [ ] Update `NoteCard.tsx` and related list UI to use indexed document metadata.
- [ ] Add empty states for:
  - no vault selected
  - empty vault
  - indexing in progress
- [ ] Add UI feedback for external file changes detected by the watcher.

### Phase 7: Editor and Linking

- [ ] Keep TipTap as the primary body editor.
- [x] Replace mention suggestions backed by `useFolders()` with local vault-backed suggestions.
- [x] Persist folder mentions as markdown wikilinks and reload them as TipTap mention nodes.
- [ ] Add rename/move propagation for folder mentions when folders are renamed or moved inside the app.
- [ ] Add rename/move support for folders and markdown files in the app UI.
- [ ] Decide how note-to-note links are represented in markdown and in the index.
- [ ] Extract note title and plain text summary from markdown for preview cards.
- [ ] Add save semantics suitable for local files:
  - autosave
  - explicit save shortcut
  - dirty state handling

### Phase 8: Templates

- [ ] Create `src/core/templates/templateTypes.ts`.
- [ ] Create a template registry that loads JSON files from app data.
- [ ] Resolve templates by `frontmatter.template`.
- [ ] Define the first template schema version.
- [ ] Add template fallback behavior when a template is missing or invalid.
- [ ] Add a generic properties panel driven by template field definitions.
- [ ] Keep template files outside the vault.
- [ ] Ensure a note remains readable as plain markdown without the template registry.

### Phase 9: Cleanup

- [ ] Remove unused auth UI and API code once the local flow is stable.
- [ ] Remove backend-specific config that is no longer part of the desktop app path.
- [ ] Update the project README to reflect the new product architecture.
- [ ] Add developer setup docs for Tauri, Rust prerequisites, and local app data paths.
- [ ] Revisit Capacitor/mobile only after desktop vault flow is stable.

## Immediate Next Slice

This is the recommended first implementation slice:

1. [x] Add Tauri and scaffold the desktop shell configuration.
2. [x] Replace the auth gate in `src/App.tsx` with a vault bootstrap screen.
3. [x] Implement `Open Folder`.
4. [x] Implement `scanVault` for folders and markdown files.
5. [x] Render the selected vault tree in the sidebar, even before indexing is complete.

## Validation

Run these after changes to the Rust vault layer:

- `npm run test:rust`
- `npm run build`

## Risks To Watch

- TipTap to markdown round-tripping can become the hardest part if handled late.
- If indexing is not incremental and fast, the app will feel worse than Obsidian immediately.
- Path-based identity alone is fragile; renames need a stable document ID strategy.
- External file edits must not silently desync the UI from disk.
- Template rendering must degrade cleanly when template definitions are missing.

## Deferred For Later

- Sync service
- AI/CLI integration
- Collaboration or multi-user features
- Mobile adaptation
- PARA or any other opinionated folder model
