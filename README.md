# Smart Notes

Smart Notes is a local-first notes app evolving toward a desktop-first knowledge and personal tracking tool.

The current direction is:

- user-selected local vault
- Markdown files as canonical note storage
- TipTap as the main editor
- Tauri as the desktop shell
- future SQLite indexing layer for speed, search, and structured views

This is no longer a plain Vite starter and no longer a backend-first notes client.

## Current Status

Implemented today:

- Tauri desktop shell
- open local folder as vault
- recursive vault scan for folders and `.md` files
- local document create/read/save/delete flows
- TipTap to Markdown round-trip
- YAML frontmatter preservation
- folder mentions persisted as wikilinks like `[[Projects/Alpha]]`

Planned next:

- SQLite local index
- file/folder rename and move in-app
- mention ref updates on rename/move
- template registry outside the vault
- richer structured views and stats

The working roadmap lives in [docs/desktop-filesystem-roadmap.md](docs/desktop-filesystem-roadmap.md).

## Tech Stack

- React
- TypeScript
- Vite
- TipTap
- Zustand
- Tauri 2
- Rust

## Development

### Requirements

- Node.js
- npm
- Rust toolchain via `rustup`
- Xcode Command Line Tools on macOS

### Install

```bash
npm install
```

### Run the web app only

```bash
npm run dev
```

### Run the desktop app

```bash
npm run tauri:dev
```

### Build

```bash
npm run build
```

### Rust tests for the vault layer

```bash
npm run test:rust
```

## Repository Notes

- `.env` files are local-only and should not be committed.
- Vault content is not stored in this repository.
- Editor/assistant instruction files are ignored for future commits where possible.

## Product Direction

Smart Notes is meant to go beyond plain note-taking:

- structured templates
- personal databases like expenses, films, and other tracked entities
- custom views
- local-first speed
- future mobile support

The open question is not whether notes should exist, but how far a local-first Markdown-centered model can be pushed before structured app data and sync need a stronger internal model.
