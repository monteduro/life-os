# Codebase Classification

This document distinguishes between the active local-first desktop code and the legacy web/API-first code still kept temporarily in the repository.

## Active

These paths are part of the current product runtime or the current local-first architecture:

- `src/App.tsx`
- `src/main.tsx`
- `src/components/layout/`
- `src/components/notes/NoteList.tsx`
- `src/components/notes/LocalNoteInline.tsx`
- `src/components/notes/FolderSelector.tsx`
- `src/components/editor/`
- `src/components/vault/`
- `src/components/Form/`
- `src/components/ui/`
- `src/core/domain/`
- `src/core/index/`
- `src/core/ports/`
- `src/core/storage/`
- `src/core/vault/`
- `src/extensions/`
- `src/stores/navigationStore.ts`
- `src/stores/vaultStore.ts`
- `src/lib/iconMap.tsx`
- `src/lib/utils.ts`
- `src/index.css`
- `src/App.css`
- `src-tauri/`

## Legacy Kept Temporarily

These paths come from the older web/API-first implementation and are not part of the active local desktop flow:

- `src/legacy/api/`
- `src/legacy/components/auth/`
- `src/legacy/components/notes/NoteCard.tsx`
- `src/legacy/components/notes/NoteInline.tsx`
- `src/legacy/components/Count/Count.tsx`
- `src/legacy/config/api.ts`
- `src/legacy/lib/queryClient.ts`
- `src/legacy/stores/counterStore.ts`

## Why Legacy Is Still Present

- feature comparison during migration
- short-term UX reference while rebuilding flows
- historical reference for old remote/web assumptions

## Current Policy

- new product work should not be added to `src/legacy`
- if a useful idea is recovered from legacy code, it should be reimplemented in the active architecture
- the presence of a legacy file does not mean it is a candidate for direct reuse in future remote mode

## Next Cleanup Decision

When the local-first migration is stable enough, decide whether to:

1. remove `src/legacy` entirely, or
2. replace it with a clean remote-mode implementation designed around the new domain and storage boundaries
