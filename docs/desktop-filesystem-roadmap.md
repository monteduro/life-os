# Desktop Filesystem Roadmap

Last updated: 2026-04-28

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

The architecture is now being shaped so the same product can later support:

- `Local Markdown mode`
- `Remote Postgres mode`

without rewriting the UI, editor, or template system.

## Target Architecture

### Layers

1. `Core domain`
   Shared document, folder, template, link, and view models regardless of persistence mode.
2. `Ports layer`
   Shared repository and service interfaces used by the app.
3. `Local Markdown adapter`
   Reads and writes folders, markdown files, attachments, moves, deletes, and file watcher events.
4. `Remote Postgres adapter`
   Will read and write the same domain model through a backend API.
5. `Index layer`
   Keeps a SQLite index in sync with the vault and serves fast queries.
6. `Template layer`
   Loads template JSON from app data, resolves note presentation and structured fields.
7. `Editor layer`
   Uses TipTap for the markdown body and a separate properties model for frontmatter data.

### Planned Modules

```text
src/core/domain/
  storage.ts

src/core/ports/
  documentRepository.ts
  workspaceRepository.ts

src/core/storage/
  activeStorage.ts

src/core/vault/
  types.ts
  vaultRepository.ts
  vaultWatcher.ts
  markdownDocument.ts

src/core/remote/
  remoteRepository.ts
  remoteClient.ts

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
- [x] Introduce shared storage ports so local markdown is not hard-coded across the app.
- [x] Keep local markdown as the primary implementation while preserving a future remote Postgres mode.
- [x] Define the initial vault contract:
  - root folder selected by the user
  - recursive folder tree
  - markdown files as notes
  - attachments preserved as-is
- [ ] Define the canonical markdown document shape:
  - YAML frontmatter
  - markdown body
  - stable note ID strategy
- [x] Decide where app data lives on disk:
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
- [x] Implement `vaultRepository.ts` with:
  - `scanVault`
  - `readDocument`
  - `saveDocument`
  - `createDocument`
  - `moveDocument`
  - `deleteDocument`
  - `listFolders`
- [ ] Implement safe path normalization and path-based guards.
- [ ] Add attachment helpers for copy/import into the vault.
- [x] Add filesystem watcher support for external changes.

### Phase 3: Markdown Canonical Format

- [x] Add a markdown parser/serializer module in `src/core/vault/markdownDocument.ts`.
- [x] Support YAML frontmatter read/write.
- [ ] Define the initial frontmatter keys:
  - `id`
  - `title`
  - `template`
  - `created_at`
  - `updated_at`
  - `tags`
- [x] Map markdown body to the current TipTap editor model.
- [x] Map TipTap output back to canonical markdown.
- [ ] Define fallback behavior for malformed frontmatter or unsupported markdown content.

### Phase 4: SQLite Index

- [x] Add SQLite integration in the Tauri layer.
- [x] Create the initial schema:
  - `documents`
  - `folders`
  - `document_links`
  - `document_tags`
  - `search_fts`
- [x] Implement an initial full-vault indexing pass.
- [x] Store content hash and last indexed timestamp per file.
- [x] Implement incremental re-indexing from watcher events.
- [x] Add full-text search queries for fast filtering and global search.
- [ ] Add index health/rebuild commands.

### Phase 5: Frontend Data Migration

- [ ] Introduce local repository-backed hooks under `src/features/documents/`.
- [ ] Keep frontend state and components wired against shared ports instead of storage-specific adapters.
- [ ] Keep TanStack Query, but swap HTTP query functions for local repository calls.
- [ ] Replace `useNotes` with a local documents hook.
- [ ] Replace `useFolders` with a folder tree hook backed by the vault/index.
- [ ] Remove the direct dependency on `src/api/client.ts` from note and folder flows.
- [ ] Decide whether legacy API modules stay temporarily under a compatibility layer or get removed early.

### Phase 6: UI Migration

- [x] Update `Sidebar.tsx` to render the real filesystem tree.
- [x] Update `AppLayout.tsx` header to show the selected folder/path instead of authenticated user state.
- [x] Update `NoteList.tsx` to read documents from the local layer.
- [x] Update `NoteInline.tsx` create/save flows to write markdown files locally.
- [ ] Update `NoteCard.tsx` and related list UI to use indexed document metadata.
- [ ] Add empty states for:
  - no vault selected
  - empty vault
  - indexing in progress
- [x] Add UI feedback for external file changes detected by the watcher.

### Phase 7: Editor and Linking

- [ ] Keep TipTap as the primary body editor.
- [x] Replace mention suggestions backed by `useFolders()` with local vault-backed suggestions.
- [x] Persist folder mentions as markdown wikilinks and reload them as TipTap mention nodes.
- [x] Add rename/move propagation for folder mentions when folders are renamed or moved inside the app.
- [x] Add rename/move support for folders and markdown files in the app UI.
- [ ] Decide how note-to-note links are represented in markdown and in the index.
- [ ] Extract note title and plain text summary from markdown for preview cards.
- [x] Add save semantics suitable for local files:
  - autosave
  - explicit save shortcut
  - dirty state handling

## Recommended Next Steps

1. `Index health commands`
   - manual rebuild
   - visible index status/debug info
   - clearer recovery path when watcher/index drift

2. `Template foundation`
   - template registry outside the vault
   - first schema version
   - generic properties panel

3. `Attachment flow`
   - import/copy into vault
   - reference from markdown/frontmatter

4. `Document linking model`
   - note-to-note links in markdown
   - index representation
   - preview/backlink behavior

## Possible Future Enhancements

- Custom folder ordering in the sidebar as app-level metadata, separate from filesystem order.
- Manual note ordering inside folders as app-level metadata, separate from filesystem order.

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
- A fake “generic storage layer” can become over-abstracted if local and remote modes are treated as interchangeable too early.

## Deferred For Later

- Sync service
- AI/CLI integration
- Collaboration or multi-user features
- Mobile adaptation
- PARA or any other opinionated folder model
