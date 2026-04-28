use notify::{
  event::{CreateKind, ModifyKind, RemoveKind},
  Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{
  collections::HashMap,
  fs,
  hash::{DefaultHasher, Hash, Hasher},
  path::{Path, PathBuf},
  sync::Mutex,
  time::SystemTime,
};
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultFolderNode {
  id: String,
  path: String,
  name: String,
  parent_path: Option<String>,
  document_count: usize,
  children: Vec<VaultFolderNode>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultDocumentSummary {
  id: String,
  path: String,
  name: String,
  title: String,
  parent_path: Option<String>,
  excerpt: String,
  updated_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultSnapshot {
  root_path: String,
  root_name: String,
  folders: Vec<VaultFolderNode>,
  documents: Vec<VaultDocumentSummary>,
  document_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultDocument {
  path: String,
  name: String,
  title: String,
  excerpt: String,
  body: String,
  raw_content: String,
  updated_at: Option<String>,
}

struct IndexedDocumentContent {
  title: String,
  excerpt: String,
  body: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalIndexStats {
  database_path: String,
  root_path: String,
  indexed_documents: usize,
  indexed_folders: usize,
  indexed_at: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultWatchEvent {
  root_path: String,
  kind: String,
  paths: Vec<String>,
}

struct VaultWatcherState {
  watcher: Mutex<Option<RecommendedWatcher>>,
}

#[derive(Clone)]
struct FolderAccumulator {
  path: String,
  name: String,
  parent_path: Option<String>,
  document_count: usize,
  child_paths: Vec<String>,
}

#[tauri::command]
fn scan_vault(root_path: String) -> Result<VaultSnapshot, String> {
  let root = fs::canonicalize(&root_path)
    .map_err(|error| format!("Impossibile accedere al vault `{root_path}`: {error}"))?;

  if !root.is_dir() {
    return Err("Il path selezionato non e` una cartella.".to_string());
  }

  let root_path_string = path_to_string(&root);
  let mut folders = HashMap::<String, FolderAccumulator>::new();
  let mut documents = Vec::<VaultDocumentSummary>::new();

  for entry in WalkDir::new(&root).min_depth(1).into_iter().filter_map(Result::ok) {
    let path = entry.path();

    if should_skip_path(&root, path) {
      continue;
    }

    if entry.file_type().is_dir() {
      let folder_path = path_to_string(path);
      let parent_path = path
        .parent()
        .map(path_to_string)
        .filter(|value| value != &root_path_string);

      folders.insert(
        folder_path.clone(),
        FolderAccumulator {
          path: folder_path,
          name: display_name(path),
          parent_path,
          document_count: 0,
          child_paths: Vec::new(),
        },
      );
      continue;
    }

    if !entry.file_type().is_file() || !is_markdown_file(path) {
      continue;
    }

    let parent_path = path
      .parent()
      .map(path_to_string)
      .unwrap_or_else(|| root_path_string.clone());

    if parent_path != root_path_string {
      if let Some(folder) = folders.get_mut(&parent_path) {
        folder.document_count += 1;
      }
    }

    documents.push(build_document_summary(path, &root_path_string)?);
  }

  let folder_links: Vec<(String, Option<String>)> = folders
    .values()
    .map(|folder| (folder.path.clone(), folder.parent_path.clone()))
    .collect();

  for (child_path, parent_path) in folder_links {
    if let Some(parent_path) = parent_path {
      if let Some(parent) = folders.get_mut(&parent_path) {
        parent.child_paths.push(child_path);
      }
    }
  }

  documents.sort_by(|left, right| {
    left
      .path
      .to_lowercase()
      .cmp(&right.path.to_lowercase())
      .then_with(|| left.title.to_lowercase().cmp(&right.title.to_lowercase()))
  });

  let mut root_children: Vec<String> = folders
    .values()
    .filter(|folder| folder.parent_path.is_none())
    .map(|folder| folder.path.clone())
    .collect();
  root_children.sort_by_key(|path| path.to_lowercase());

  let folder_tree = root_children
    .iter()
    .filter_map(|path| build_folder_tree(path, &folders))
    .collect::<Vec<_>>();

  Ok(VaultSnapshot {
    root_path: root_path_string,
    root_name: display_name(&root),
    document_count: documents.len(),
    folders: folder_tree,
    documents,
  })
}

#[tauri::command]
fn create_folder(root_path: String, parent_path: Option<String>, name: String) -> Result<String, String> {
  let root = resolve_existing_dir(&root_path, "vault")?;
  let target_parent = match parent_path.as_deref() {
    Some(path) => resolve_existing_dir(path, "cartella destinazione")?,
    None => root.clone(),
  };

  if !target_parent.starts_with(&root) {
    return Err("La cartella di destinazione non appartiene al vault corrente.".to_string());
  }

  let safe_name = sanitize_folder_name(&name);
  let folder_path = build_unique_folder_path(&target_parent, &safe_name);

  fs::create_dir_all(&folder_path)
    .map_err(|error| format!("Impossibile creare la cartella `{}`: {error}", folder_path.display()))?;

  Ok(path_to_string(&folder_path))
}

#[tauri::command]
fn rename_folder(path: String, name: String) -> Result<String, String> {
  let source_path = resolve_existing_dir(&path, "cartella da rinominare")?;
  let parent_dir = source_path
    .parent()
    .ok_or_else(|| "Impossibile determinare la cartella padre.".to_string())?;

  let safe_name = sanitize_folder_name(&name);
  let destination_path = build_unique_folder_path(parent_dir, &safe_name);

  fs::rename(&source_path, &destination_path).map_err(|error| {
    format!(
      "Impossibile rinominare `{}` in `{}`: {error}",
      source_path.display(),
      destination_path.display()
    )
  })?;

  Ok(path_to_string(&destination_path))
}

#[tauri::command]
fn move_folder(root_path: String, path: String, target_parent_path: Option<String>) -> Result<String, String> {
  let root = resolve_existing_dir(&root_path, "vault")?;
  let source_path = resolve_existing_dir(&path, "cartella da spostare")?;
  let target_parent = match target_parent_path.as_deref() {
    Some(path) => resolve_existing_dir(path, "cartella destinazione")?,
    None => root.clone(),
  };

  if !source_path.starts_with(&root) || !target_parent.starts_with(&root) {
    return Err("La cartella non appartiene al vault corrente.".to_string());
  }

  if target_parent == source_path {
    return Err("Una cartella non puo` essere spostata dentro se stessa.".to_string());
  }

  if target_parent.starts_with(&source_path) {
    return Err("Una cartella non puo` essere spostata dentro una sua sottocartella.".to_string());
  }

  let folder_name = source_path
    .file_name()
    .and_then(|name| name.to_str())
    .ok_or_else(|| "Impossibile determinare il nome della cartella.".to_string())?;
  let destination_path = build_unique_folder_path(&target_parent, folder_name);

  fs::rename(&source_path, &destination_path).map_err(|error| {
    format!(
      "Impossibile spostare `{}` in `{}`: {error}",
      source_path.display(),
      destination_path.display()
    )
  })?;

  Ok(path_to_string(&destination_path))
}

#[tauri::command]
fn read_document(path: String) -> Result<VaultDocument, String> {
  let document_path = PathBuf::from(&path);
  let raw_content = fs::read_to_string(&document_path)
    .map_err(|error| format!("Impossibile leggere `{path}`: {error}"))?;

  let body = strip_frontmatter(&raw_content);

  Ok(VaultDocument {
    path: path_to_string(&document_path),
    name: display_name(&document_path),
    title: extract_title(&body, &document_path),
    excerpt: build_excerpt(&body),
    body,
    raw_content,
    updated_at: read_modified_timestamp(&document_path),
  })
}

#[tauri::command]
fn create_document(
  root_path: String,
  parent_path: Option<String>,
  title: Option<String>,
  content: Option<String>,
) -> Result<VaultDocument, String> {
  let root = resolve_existing_dir(&root_path, "vault")?;
  let root_string = path_to_string(&root);
  let creating_in_root = parent_path.is_none();

  let target_dir = match parent_path.as_deref() {
    Some(path) => resolve_existing_dir(path, "cartella destinazione")?,
    None => root.clone(),
  };

  if !target_dir.starts_with(&root) {
    return Err("La cartella di destinazione non appartiene al vault corrente.".to_string());
  }

  let requested_title = title.unwrap_or_else(|| "Untitled".to_string());
  let safe_stem = sanitize_file_stem(&requested_title);
  let document_path = build_unique_document_path(&target_dir, &safe_stem);
  let initial_content = content.unwrap_or_default();

  fs::write(&document_path, initial_content)
    .map_err(|error| format!("Impossibile creare `{}`: {error}", document_path.display()))?;

  let created_document = read_document(path_to_string(&document_path))?;
  let parent = document_path.parent().map(path_to_string).filter(|value| value != &root_string);

  if creating_in_root && parent.is_some() {
    return Err("La nota creata in root ha un parent non previsto.".to_string());
  }

  Ok(created_document)
}

#[tauri::command]
fn save_document(path: String, content: String) -> Result<VaultDocument, String> {
  let document_path = PathBuf::from(&path);
  ensure_markdown_path(&document_path)?;

  fs::write(&document_path, content)
    .map_err(|error| format!("Impossibile salvare `{path}`: {error}"))?;

  read_document(path)
}

#[tauri::command]
fn delete_document(path: String) -> Result<(), String> {
  let document_path = PathBuf::from(&path);
  ensure_markdown_path(&document_path)?;

  fs::remove_file(&document_path)
    .map_err(|error| format!("Impossibile eliminare `{path}`: {error}"))?;

  Ok(())
}

#[tauri::command]
fn move_document(
  path: String,
  target_folder_path: String,
  file_name: Option<String>,
) -> Result<VaultDocument, String> {
  let source_path = PathBuf::from(&path);
  ensure_markdown_path(&source_path)?;

  let target_dir = resolve_existing_dir(&target_folder_path, "cartella destinazione")?;
  let current_stem = source_path
    .file_stem()
    .and_then(|stem| stem.to_str())
    .unwrap_or("Untitled");
  let desired_stem = file_name.unwrap_or_else(|| current_stem.to_string());
  let safe_stem = sanitize_file_stem(&desired_stem);
  let destination_path = build_unique_document_path(&target_dir, &safe_stem);

  fs::rename(&source_path, &destination_path).map_err(|error| {
    format!(
      "Impossibile spostare `{}` in `{}`: {error}",
      source_path.display(),
      destination_path.display()
    )
  })?;

  read_document(path_to_string(&destination_path))
}

#[tauri::command]
fn rebuild_local_index(app: AppHandle, root_path: String) -> Result<LocalIndexStats, String> {
  let database_path = local_index_database_path(&app, &root_path)?;
  rebuild_local_index_at_path(&database_path, &root_path)
}

#[tauri::command]
fn search_local_index(
  app: AppHandle,
  root_path: String,
  query: String,
) -> Result<Vec<VaultDocumentSummary>, String> {
  let normalized_query = normalize_search_query(&query);
  if normalized_query.is_empty() {
    return Ok(Vec::new());
  }

  let database_path = local_index_database_path(&app, &root_path)?;
  let connection = Connection::open(&database_path).map_err(|error| {
    format!(
      "Impossibile aprire il database indice `{}`: {error}",
      database_path.display()
    )
  })?;

  initialize_local_index_schema(&connection)?;

  let mut statement = connection
    .prepare(
      "
        SELECT
          d.path,
          d.name,
          d.title,
          d.parent_path,
          d.excerpt,
          d.updated_at
        FROM search_fts fts
        JOIN documents d
          ON d.path = fts.path
         AND d.root_path = fts.root_path
        WHERE fts.root_path = ?1
          AND search_fts MATCH ?2
        ORDER BY bm25(search_fts), CAST(COALESCE(d.updated_at, '0') AS INTEGER) DESC
        LIMIT 100
      ",
    )
    .map_err(|error| format!("Impossibile preparare la query di ricerca: {error}"))?;

  let rows = statement
    .query_map(params![root_path.as_str(), normalized_query.as_str()], |row| {
      Ok(VaultDocumentSummary {
        id: row.get(0)?,
        path: row.get(0)?,
        name: row.get(1)?,
        title: row.get(2)?,
        parent_path: row.get(3)?,
        excerpt: row.get(4)?,
        updated_at: row.get(5)?,
      })
    })
    .map_err(|error| format!("Impossibile eseguire la ricerca sull'indice locale: {error}"))?;

  let mut results = Vec::new();
  for row in rows {
    results.push(row.map_err(|error| format!("Impossibile leggere un risultato di ricerca: {error}"))?);
  }

  Ok(results)
}

#[tauri::command]
fn start_vault_watcher(
  app: AppHandle,
  state: tauri::State<'_, VaultWatcherState>,
  root_path: String,
) -> Result<(), String> {
  let root = fs::canonicalize(&root_path)
    .map_err(|error| format!("Impossibile avviare il watcher per `{root_path}`: {error}"))?;
  let canonical_root_path = path_to_string(&root);
  let database_path = local_index_database_path(&app, &canonical_root_path)?;
  let app_handle = app.clone();

  let mut watcher = notify::recommended_watcher(move |result: Result<Event, notify::Error>| {
    if let Ok(event) = result {
      let _ = handle_vault_watch_event(&app_handle, &canonical_root_path, &database_path, event);
    }
  })
  .map_err(|error| format!("Impossibile creare il watcher filesystem: {error}"))?;

  watcher
    .watch(&root, RecursiveMode::Recursive)
    .map_err(|error| format!("Impossibile osservare il vault `{}`: {error}", root.display()))?;

  let mut active_watcher = state
    .watcher
    .lock()
    .map_err(|_| "Impossibile acquisire il lock del watcher.".to_string())?;
  *active_watcher = Some(watcher);

  Ok(())
}

fn build_document_summary(
  path: &Path,
  root_path: &str,
) -> Result<VaultDocumentSummary, String> {
  let raw_content = fs::read_to_string(path)
    .map_err(|error| format!("Impossibile leggere `{}`: {error}", path.display()))?;
  let body = strip_frontmatter(&raw_content);
  let parent_path = path.parent().map(path_to_string).filter(|value| value != root_path);

  Ok(VaultDocumentSummary {
    id: path_to_string(path),
    path: path_to_string(path),
    name: display_name(path),
    title: extract_title(&body, path),
    parent_path,
    excerpt: build_excerpt(&body),
    updated_at: read_modified_timestamp(path),
  })
}

fn read_indexed_document_content(path: &Path) -> Result<IndexedDocumentContent, String> {
  let raw_content = fs::read_to_string(path)
    .map_err(|error| format!("Impossibile leggere `{}` per l'indice: {error}", path.display()))?;
  let body = strip_frontmatter(&raw_content);

  Ok(IndexedDocumentContent {
    title: extract_title(&body, path),
    excerpt: build_excerpt(&body),
    body,
  })
}

fn rebuild_local_index_at_path(database_path: &Path, root_path: &str) -> Result<LocalIndexStats, String> {
  let snapshot = scan_vault(root_path.to_string())?;
  let indexed_at = current_timestamp_string()?;

  if let Some(parent) = database_path.parent() {
    fs::create_dir_all(parent).map_err(|error| {
      format!(
        "Impossibile creare la cartella del database indice `{}`: {error}",
        parent.display()
      )
    })?;
  }

  let connection = Connection::open(database_path).map_err(|error| {
    format!(
      "Impossibile aprire il database indice `{}`: {error}",
      database_path.display()
    )
  })?;

  initialize_local_index_schema(&connection)?;

  connection
    .execute("DELETE FROM documents WHERE root_path = ?1", params![snapshot.root_path.as_str()])
    .map_err(|error| format!("Impossibile svuotare i documenti indicizzati: {error}"))?;
  connection
    .execute("DELETE FROM folders WHERE root_path = ?1", params![snapshot.root_path.as_str()])
    .map_err(|error| format!("Impossibile svuotare le cartelle indicizzate: {error}"))?;
  connection
    .execute("DELETE FROM document_links WHERE root_path = ?1", params![snapshot.root_path.as_str()])
    .map_err(|error| format!("Impossibile svuotare i link indicizzati: {error}"))?;
  connection
    .execute("DELETE FROM document_tags WHERE root_path = ?1", params![snapshot.root_path.as_str()])
    .map_err(|error| format!("Impossibile svuotare i tag indicizzati: {error}"))?;
  connection
    .execute("DELETE FROM search_fts WHERE root_path = ?1", params![snapshot.root_path.as_str()])
    .map_err(|error| format!("Impossibile svuotare il full-text index: {error}"))?;

  let transaction = connection
    .unchecked_transaction()
    .map_err(|error| format!("Impossibile iniziare la transazione indice: {error}"))?;

  {
    let mut folder_statement = transaction
      .prepare(
        "INSERT INTO folders (path, root_path, name, parent_path, document_count, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      )
      .map_err(|error| format!("Impossibile preparare l'inserimento cartelle: {error}"))?;

    for folder in flatten_folder_nodes(&snapshot.folders) {
      folder_statement
        .execute(params![
          folder.path.as_str(),
          snapshot.root_path.as_str(),
          folder.name.as_str(),
          folder.parent_path.as_deref(),
          folder.document_count as i64,
          indexed_at.as_str(),
        ])
        .map_err(|error| format!("Impossibile indicizzare la cartella `{}`: {error}", folder.path))?;
    }
  }

  {
    let mut document_statement = transaction
      .prepare(
        "INSERT INTO documents (
          path, root_path, name, title, parent_path, excerpt, updated_at, indexed_at, content_hash
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
      )
      .map_err(|error| format!("Impossibile preparare l'inserimento documenti: {error}"))?;

    for document in &snapshot.documents {
      let content_hash = build_document_index_hash(document);
      document_statement
        .execute(params![
          document.path.as_str(),
          snapshot.root_path.as_str(),
          document.name.as_str(),
          document.title.as_str(),
          document.parent_path.as_deref(),
          document.excerpt.as_str(),
          document.updated_at.as_deref(),
          indexed_at.as_str(),
          content_hash.as_str(),
        ])
        .map_err(|error| format!("Impossibile indicizzare il documento `{}`: {error}", document.path))?;
    }
  }

  {
    let mut search_statement = transaction
      .prepare(
        "INSERT INTO search_fts (path, title, excerpt, body, root_path)
         VALUES (?1, ?2, ?3, ?4, ?5)",
      )
      .map_err(|error| format!("Impossibile preparare l'inserimento search_fts: {error}"))?;

    for document in &snapshot.documents {
      let indexed_content = read_indexed_document_content(Path::new(&document.path))?;
      search_statement
        .execute(params![
          document.path.as_str(),
          indexed_content.title.as_str(),
          indexed_content.excerpt.as_str(),
          indexed_content.body.as_str(),
          snapshot.root_path.as_str(),
        ])
        .map_err(|error| format!("Impossibile indicizzare il testo di `{}`: {error}", document.path))?;
    }
  }

  transaction
    .commit()
    .map_err(|error| format!("Impossibile confermare l'indicizzazione: {error}"))?;

  Ok(LocalIndexStats {
    database_path: path_to_string(database_path),
    root_path: snapshot.root_path,
    indexed_documents: snapshot.documents.len(),
    indexed_folders: count_folder_nodes(&snapshot.folders),
    indexed_at,
  })
}

fn handle_vault_watch_event(
  app: &AppHandle,
  root_path: &str,
  database_path: &Path,
  event: Event,
) -> Result<(), String> {
  let visible_paths = event
    .paths
    .iter()
    .filter(|path| !should_skip_path(Path::new(root_path), path))
    .map(|path| path_to_string(path))
    .collect::<Vec<_>>();

  if visible_paths.is_empty() {
    return Ok(());
  }

  let kind_label = event_kind_label(&event.kind);

  match &event.kind {
    EventKind::Modify(ModifyKind::Data(_)) | EventKind::Modify(ModifyKind::Metadata(_)) => {
      for path in &event.paths {
        if path.is_file() && is_markdown_file(path) {
          upsert_document_in_index(database_path, root_path, path)?;
        }
      }
    }
    EventKind::Create(CreateKind::File)
    | EventKind::Remove(RemoveKind::File)
    | EventKind::Modify(ModifyKind::Name(_))
    | EventKind::Create(_)
    | EventKind::Remove(_)
    | EventKind::Modify(_)
    | EventKind::Any
    | EventKind::Other => {
      let _ = rebuild_local_index_at_path(database_path, root_path)?;
    }
    _ => {}
  }

  app
    .emit(
      "vault-watch-updated",
      VaultWatchEvent {
        root_path: root_path.to_string(),
        kind: kind_label.to_string(),
        paths: visible_paths,
      },
    )
    .map_err(|error| format!("Impossibile emettere l'evento watcher: {error}"))?;

  Ok(())
}

fn upsert_document_in_index(database_path: &Path, root_path: &str, path: &Path) -> Result<(), String> {
  let summary = build_document_summary(path, root_path)?;
  let indexed_content = read_indexed_document_content(path)?;
  let indexed_at = current_timestamp_string()?;
  let content_hash = build_document_index_hash(&summary);

  if let Some(parent) = database_path.parent() {
    fs::create_dir_all(parent).map_err(|error| {
      format!(
        "Impossibile creare la cartella del database indice `{}`: {error}",
        parent.display()
      )
    })?;
  }

  let connection = Connection::open(database_path).map_err(|error| {
    format!(
      "Impossibile aprire il database indice `{}`: {error}",
      database_path.display()
    )
  })?;

  initialize_local_index_schema(&connection)?;

  connection
    .execute(
      "
        INSERT INTO documents (
          path, root_path, name, title, parent_path, excerpt, updated_at, indexed_at, content_hash
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          title = excluded.title,
          parent_path = excluded.parent_path,
          excerpt = excluded.excerpt,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at,
          content_hash = excluded.content_hash
      ",
      params![
        summary.path.as_str(),
        root_path,
        summary.name.as_str(),
        summary.title.as_str(),
        summary.parent_path.as_deref(),
        summary.excerpt.as_str(),
        summary.updated_at.as_deref(),
        indexed_at.as_str(),
        content_hash.as_str(),
      ],
    )
    .map_err(|error| format!("Impossibile aggiornare il documento nell'indice: {error}"))?;

  connection
    .execute(
      "DELETE FROM search_fts WHERE path = ?1 AND root_path = ?2",
      params![summary.path.as_str(), root_path],
    )
    .and_then(|_| {
      connection.execute(
        "INSERT INTO search_fts (path, title, excerpt, body, root_path) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
          summary.path.as_str(),
          indexed_content.title.as_str(),
          indexed_content.excerpt.as_str(),
          indexed_content.body.as_str(),
          root_path,
        ],
      )
    })
    .map_err(|error| format!("Impossibile aggiornare il full-text index del documento: {error}"))?;

  Ok(())
}

fn initialize_local_index_schema(connection: &Connection) -> Result<(), String> {
  connection.execute_batch(
    "
      CREATE TABLE IF NOT EXISTS documents (
        path TEXT PRIMARY KEY,
        root_path TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        parent_path TEXT,
        excerpt TEXT NOT NULL,
        updated_at TEXT,
        indexed_at TEXT NOT NULL,
        content_hash TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_documents_root_path ON documents(root_path);
      CREATE INDEX IF NOT EXISTS idx_documents_parent_path ON documents(parent_path);
      CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);

      CREATE TABLE IF NOT EXISTS document_links (
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        root_path TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_document_links_root_path ON document_links(root_path);
      CREATE INDEX IF NOT EXISTS idx_document_links_source_path ON document_links(source_path);

      CREATE TABLE IF NOT EXISTS folders (
        path TEXT PRIMARY KEY,
        root_path TEXT NOT NULL,
        name TEXT NOT NULL,
        parent_path TEXT,
        document_count INTEGER NOT NULL,
        indexed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_folders_root_path ON folders(root_path);
      CREATE INDEX IF NOT EXISTS idx_folders_parent_path ON folders(parent_path);

      CREATE TABLE IF NOT EXISTS document_tags (
        document_path TEXT NOT NULL,
        tag TEXT NOT NULL,
        root_path TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_document_tags_root_path ON document_tags(root_path);
      CREATE INDEX IF NOT EXISTS idx_document_tags_document_path ON document_tags(document_path);

      CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
        path UNINDEXED,
        title,
        excerpt,
        body,
        root_path UNINDEXED
      );
    ",
  )
  .map_err(|error| format!("Impossibile inizializzare lo schema SQLite: {error}"))?;

  ensure_search_fts_columns(connection)?;

  Ok(())
}

fn ensure_search_fts_columns(connection: &Connection) -> Result<(), String> {
  let mut statement = connection
    .prepare("PRAGMA table_info(search_fts)")
    .map_err(|error| format!("Impossibile leggere lo schema di search_fts: {error}"))?;

  let columns = statement
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(|error| format!("Impossibile ispezionare le colonne di search_fts: {error}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|error| format!("Impossibile leggere una colonna di search_fts: {error}"))?;

  if columns.iter().any(|column| column == "body") {
    return Ok(());
  }

  connection
    .execute_batch(
      "
        DROP TABLE IF EXISTS search_fts;
        CREATE VIRTUAL TABLE search_fts USING fts5(
          path UNINDEXED,
          title,
          excerpt,
          body,
          root_path UNINDEXED
        );
      ",
    )
    .map_err(|error| format!("Impossibile aggiornare lo schema di search_fts: {error}"))?;

  Ok(())
}

fn local_index_database_path(app: &AppHandle, root_path: &str) -> Result<PathBuf, String> {
  let app_data_dir = app
    .path()
    .app_local_data_dir()
    .map_err(|error| format!("Impossibile risolvere la cartella dati dell'app: {error}"))?;

  let root_hash = hash_string(root_path);
  Ok(app_data_dir.join("index").join(format!("vault-{root_hash}.sqlite")))
}

fn flatten_folder_nodes(nodes: &[VaultFolderNode]) -> Vec<&VaultFolderNode> {
  let mut flattened = Vec::new();

  for node in nodes {
    flattened.push(node);
    flattened.extend(flatten_folder_nodes(&node.children));
  }

  flattened
}

fn count_folder_nodes(nodes: &[VaultFolderNode]) -> usize {
  nodes
    .iter()
    .map(|node| 1 + count_folder_nodes(&node.children))
    .sum()
}

fn build_document_index_hash(document: &VaultDocumentSummary) -> String {
  hash_string(&format!(
    "{}|{}|{}|{}|{}",
    document.path,
    document.title,
    document.excerpt,
    document.parent_path.as_deref().unwrap_or(""),
    document.updated_at.as_deref().unwrap_or("")
  ))
}

fn normalize_search_query(query: &str) -> String {
  query
    .split_whitespace()
    .map(|term| {
      term
        .chars()
        .filter(|character| character.is_alphanumeric() || matches!(character, '_' | '-'))
        .collect::<String>()
    })
    .filter(|term| !term.is_empty())
    .map(|term| format!("{term}*"))
    .collect::<Vec<_>>()
    .join(" OR ")
}

fn event_kind_label(kind: &EventKind) -> &'static str {
  match kind {
    EventKind::Create(_) => "create",
    EventKind::Modify(_) => "modify",
    EventKind::Remove(_) => "remove",
    EventKind::Any => "any",
    EventKind::Other => "other",
    _ => "other",
  }
}

fn hash_string(value: &str) -> String {
  let mut hasher = DefaultHasher::new();
  value.hash(&mut hasher);
  format!("{:016x}", hasher.finish())
}

fn current_timestamp_string() -> Result<String, String> {
  Ok(
    SystemTime::now()
      .duration_since(SystemTime::UNIX_EPOCH)
      .map_err(|error| format!("Impossibile leggere l'orologio di sistema: {error}"))?
      .as_secs()
      .to_string(),
  )
}

fn build_folder_tree(
  path: &str,
  folders: &HashMap<String, FolderAccumulator>,
) -> Option<VaultFolderNode> {
  let folder = folders.get(path)?;
  let mut child_paths = folder.child_paths.clone();
  child_paths.sort_by_key(|value| value.to_lowercase());

  let children = child_paths
    .iter()
    .filter_map(|child_path| build_folder_tree(child_path, folders))
    .collect::<Vec<_>>();

  Some(VaultFolderNode {
    id: folder.path.clone(),
    path: folder.path.clone(),
    name: folder.name.clone(),
    parent_path: folder.parent_path.clone(),
    document_count: folder.document_count,
    children,
  })
}

fn should_skip_path(root: &Path, path: &Path) -> bool {
  path
    .strip_prefix(root)
    .ok()
    .map(|relative_path| {
      relative_path.components().any(|component| {
        component
          .as_os_str()
          .to_string_lossy()
          .starts_with('.')
      })
    })
    .unwrap_or(false)
}

fn resolve_existing_dir(path: &str, label: &str) -> Result<PathBuf, String> {
  let resolved = fs::canonicalize(path)
    .map_err(|error| format!("Impossibile accedere a {label} `{path}`: {error}"))?;

  if !resolved.is_dir() {
    return Err(format!("Il path `{path}` non e` una cartella valida."));
  }

  Ok(resolved)
}

fn is_markdown_file(path: &Path) -> bool {
  path
    .extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "md" | "markdown"))
    .unwrap_or(false)
}

fn ensure_markdown_path(path: &Path) -> Result<(), String> {
  if !is_markdown_file(path) {
    return Err(format!(
      "Il file `{}` non e` un documento Markdown supportato.",
      path.display()
    ));
  }

  Ok(())
}

fn sanitize_file_stem(value: &str) -> String {
  let cleaned = value
    .trim()
    .chars()
    .map(|character| match character {
      '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
      _ => character,
    })
    .collect::<String>();

  let normalized = cleaned
    .split_whitespace()
    .filter(|segment| !segment.is_empty())
    .collect::<Vec<_>>()
    .join(" ");

  if normalized.is_empty() {
    "Untitled".to_string()
  } else {
    normalized
  }
}

fn sanitize_folder_name(value: &str) -> String {
  let sanitized = sanitize_file_stem(value).trim_end_matches('.').trim().to_string();
  if sanitized.is_empty() {
    "Untitled".to_string()
  } else {
    sanitized
  }
}

fn build_unique_document_path(target_dir: &Path, stem: &str) -> PathBuf {
  let mut counter = 0usize;

  loop {
    let file_name = if counter == 0 {
      format!("{stem}.md")
    } else {
      format!("{stem} {counter}.md")
    };

    let candidate = target_dir.join(file_name);
    if !candidate.exists() {
      return candidate;
    }

    counter += 1;
  }
}

fn build_unique_folder_path(target_dir: &Path, name: &str) -> PathBuf {
  let mut counter = 0usize;

  loop {
    let folder_name = if counter == 0 {
      name.to_string()
    } else {
      format!("{name} {counter}")
    };

    let candidate = target_dir.join(folder_name);
    if !candidate.exists() {
      return candidate;
    }

    counter += 1;
  }
}

fn strip_frontmatter(content: &str) -> String {
  let mut lines = content.lines();
  if lines.next() != Some("---") {
    return content.trim().to_string();
  }

  let mut body_lines = Vec::new();
  let mut frontmatter_closed = false;

  for line in lines {
    if !frontmatter_closed && line == "---" {
      frontmatter_closed = true;
      continue;
    }

    if frontmatter_closed {
      body_lines.push(line);
    }
  }

  if frontmatter_closed {
    body_lines.join("\n").trim().to_string()
  } else {
    content.trim().to_string()
  }
}

fn extract_title(content: &str, path: &Path) -> String {
  for line in content.lines() {
    let trimmed = line.trim();
    if let Some(title) = trimmed.strip_prefix("# ") {
      if !title.trim().is_empty() {
        return title.trim().to_string();
      }
    }
  }

  path
    .file_stem()
    .and_then(|stem| stem.to_str())
    .map(|stem| stem.to_string())
    .unwrap_or_else(|| display_name(path))
}

fn build_excerpt(content: &str) -> String {
  let collapsed = content.split_whitespace().collect::<Vec<_>>().join(" ");
  if collapsed.chars().count() <= 240 {
    return collapsed;
  }

  let excerpt = collapsed.chars().take(240).collect::<String>();
  format!("{excerpt}…")
}

fn read_modified_timestamp(path: &Path) -> Option<String> {
  path
    .metadata()
    .ok()
    .and_then(|metadata| metadata.modified().ok())
    .and_then(|value| value.duration_since(SystemTime::UNIX_EPOCH).ok())
    .map(|duration| duration.as_secs().to_string())
}

fn display_name(path: &Path) -> String {
  path
    .file_name()
    .and_then(|name| name.to_str())
    .map(|name| name.to_string())
    .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn path_to_string(path: &Path) -> String {
  path.to_string_lossy().to_string()
}

pub fn run() {
  tauri::Builder::default()
    .manage(VaultWatcherState {
      watcher: Mutex::new(None),
    })
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      scan_vault,
      read_document,
      create_document,
      save_document,
      delete_document,
      move_document,
      create_folder,
      rename_folder,
      move_folder,
      rebuild_local_index,
      search_local_index,
      start_vault_watcher
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application")
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::{
    env,
    fs::{self, create_dir_all},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
  };

  static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

  fn create_temp_vault() -> PathBuf {
    let nanos = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .expect("system time before unix epoch")
      .as_nanos();
    let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    let path = env::temp_dir().join(format!(
      "smart-notes-tests-{}-{}-{}",
      std::process::id(),
      nanos,
      counter
    ));

    create_dir_all(&path).expect("failed to create temp vault");
    path
  }

  fn write_file(path: &Path, content: &str) {
    if let Some(parent) = path.parent() {
      create_dir_all(parent).expect("failed to create parent directories");
    }
    fs::write(path, content).expect("failed to write fixture file");
  }

  #[test]
  fn scan_vault_indexes_root_and_nested_markdown() {
    let vault = create_temp_vault();
    let canonical_vault = fs::canonicalize(&vault).expect("failed to canonicalize temp vault");

    write_file(
      &vault.join("Root Note.md"),
      "# Root Note\n\nThis note lives in the root.",
    );
    write_file(
      &vault.join("Projects").join("Roadmap.md"),
      "# Roadmap\n\nNested document.",
    );
    write_file(
      &vault.join(".hidden").join("Secret.md"),
      "# Secret\n\nShould be ignored.",
    );
    write_file(&vault.join("ignore.txt"), "plain text");

    let snapshot = scan_vault(path_to_string(&vault)).expect("scan_vault should succeed");

    assert_eq!(snapshot.document_count, 2);
    assert_eq!(snapshot.documents.len(), 2);

    let root_document = snapshot
      .documents
      .iter()
      .find(|document| document.name == "Root Note.md")
      .expect("root markdown file should be indexed");
    assert_eq!(root_document.parent_path, None);
    assert_eq!(root_document.title, "Root Note");

    let nested_document = snapshot
      .documents
      .iter()
      .find(|document| document.name == "Roadmap.md")
      .expect("nested markdown file should be indexed");
    assert_eq!(
      nested_document.parent_path,
      Some(path_to_string(&canonical_vault.join("Projects")))
    );

    assert_eq!(snapshot.folders.len(), 1);
    assert_eq!(snapshot.folders[0].name, "Projects");
    assert_eq!(snapshot.folders[0].document_count, 1);
  }

  #[test]
  fn read_document_strips_frontmatter_and_extracts_heading_title() {
    let vault = create_temp_vault();
    let document_path = vault.join("movie.md");

    write_file(
      &document_path,
      "---\n\
id: movie-1\n\
template: movie-v1\n\
---\n\
\n\
# Interstellar\n\
\n\
Great soundtrack and visuals.\n",
    );

    let document =
      read_document(path_to_string(&document_path)).expect("read_document should succeed");

    assert_eq!(document.title, "Interstellar");
    assert!(!document.body.contains("template: movie-v1"));
    assert!(document.body.starts_with("# Interstellar"));
    assert!(document.excerpt.contains("Great soundtrack"));
    assert!(document.updated_at.is_some());
  }

  #[test]
  fn read_document_falls_back_to_filename_when_heading_is_missing() {
    let vault = create_temp_vault();
    let document_path = vault.join("daily-note.md");

    write_file(&document_path, "No heading here.\n\nJust plain text.");

    let document =
      read_document(path_to_string(&document_path)).expect("read_document should succeed");

    assert_eq!(document.title, "daily-note");
    assert_eq!(document.name, "daily-note.md");
  }

  #[test]
  fn create_document_creates_unique_markdown_files() {
    let vault = create_temp_vault();

    let first = create_document(
      path_to_string(&vault),
      None,
      Some("Meeting Notes".to_string()),
      Some("# Meeting Notes\n\nFirst".to_string()),
    )
    .expect("first document creation should succeed");

    let second = create_document(
      path_to_string(&vault),
      None,
      Some("Meeting Notes".to_string()),
      Some("# Meeting Notes\n\nSecond".to_string()),
    )
    .expect("second document creation should succeed");

    assert_eq!(first.name, "Meeting Notes.md");
    assert_eq!(second.name, "Meeting Notes 1.md");
    assert!(PathBuf::from(first.path).exists());
    assert!(PathBuf::from(second.path).exists());
  }

  #[test]
  fn save_document_overwrites_existing_markdown() {
    let vault = create_temp_vault();
    let document_path = vault.join("editable.md");

    write_file(&document_path, "# Before\n\nOld body.");

    let saved = save_document(
      path_to_string(&document_path),
      "# After\n\nUpdated body.".to_string(),
    )
    .expect("save_document should succeed");

    assert_eq!(saved.title, "After");
    assert!(saved.body.contains("Updated body."));
  }

  #[test]
  fn move_and_delete_document_update_filesystem() {
    let vault = create_temp_vault();
    let source_path = vault.join("source.md");
    let archive_dir = vault.join("Archive");

    write_file(&source_path, "# Source\n\nBody.");
    create_dir_all(&archive_dir).expect("failed to create archive directory");

    let moved = move_document(
      path_to_string(&source_path),
      path_to_string(&archive_dir),
      Some("Moved Note".to_string()),
    )
    .expect("move_document should succeed");

    assert_eq!(moved.name, "Moved Note.md");
    assert!(PathBuf::from(&moved.path).exists());
    assert!(!source_path.exists());

    delete_document(moved.path.clone()).expect("delete_document should succeed");
    assert!(!PathBuf::from(moved.path).exists());
  }

  #[test]
  fn create_folder_creates_unique_directories() {
    let vault = create_temp_vault();

    let first = create_folder(path_to_string(&vault), None, "Projects".to_string())
      .expect("first folder creation should succeed");
    let second = create_folder(path_to_string(&vault), None, "Projects".to_string())
      .expect("second folder creation should succeed");

    assert!(PathBuf::from(&first).exists());
    assert!(PathBuf::from(&second).exists());
    assert_ne!(first, second);
  }

  #[test]
  fn rename_folder_renames_directory_on_filesystem() {
    let vault = create_temp_vault();
    let source = vault.join("Drafts");

    create_dir_all(&source).expect("failed to create source folder");

    let renamed = rename_folder(path_to_string(&source), "Archive".to_string())
      .expect("rename_folder should succeed");

    assert!(PathBuf::from(&renamed).exists());
    assert!(!source.exists());
  }

  #[test]
  fn move_folder_moves_directory_under_new_parent() {
    let vault = create_temp_vault();
    let source = vault.join("Drafts");
    let target_parent = vault.join("Projects");

    create_dir_all(&source).expect("failed to create source folder");
    create_dir_all(&target_parent).expect("failed to create target parent");

    let moved = move_folder(
      path_to_string(&vault),
      path_to_string(&source),
      Some(path_to_string(&target_parent)),
    )
    .expect("move_folder should succeed");

    let moved_path = PathBuf::from(&moved);
    let canonical_target_parent = fs::canonicalize(&target_parent).expect("should canonicalize target parent");
    assert!(moved_path.exists());
    assert_eq!(moved_path.parent(), Some(canonical_target_parent.as_path()));
    assert!(!source.exists());
  }

  #[test]
  fn rebuild_local_index_creates_sqlite_index_for_vault() {
    let vault = create_temp_vault();
    let database_path = vault.join(".life-os-index.sqlite");

    write_file(&vault.join("Root Note.md"), "# Root Note\n\nBody.");
    write_file(&vault.join("Projects").join("Roadmap.md"), "# Roadmap\n\nNested body.");

    let stats = rebuild_local_index_at_path(&database_path, &path_to_string(&vault))
      .expect("local index rebuild should succeed");

    assert_eq!(stats.indexed_documents, 2);
    assert_eq!(stats.indexed_folders, 1);
    assert!(database_path.exists());

    let connection = Connection::open(&database_path).expect("should reopen sqlite db");
    let document_count: i64 = connection
      .query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))
      .expect("should count indexed documents");
    let folder_count: i64 = connection
      .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
      .expect("should count indexed folders");
    let fts_count: i64 = connection
      .query_row("SELECT COUNT(*) FROM search_fts", [], |row| row.get(0))
      .expect("should count indexed search rows");

    assert_eq!(document_count, 2);
    assert_eq!(folder_count, 1);
    assert_eq!(fts_count, 2);
  }

  #[test]
  fn search_local_index_returns_matching_documents() {
    let vault = create_temp_vault();
    let database_path = vault.join(".life-os-index.sqlite");

    let long_body = format!(
      "# Budget\n\n{} needleterm",
      "filler ".repeat(80)
    );

    write_file(&vault.join("Root Note.md"), &long_body);
    write_file(&vault.join("Projects").join("Roadmap.md"), "# Roadmap\n\nNested body.");

    let stats = rebuild_local_index_at_path(&database_path, &path_to_string(&vault))
      .expect("local index rebuild should succeed");

    let connection = Connection::open(&database_path).expect("should reopen sqlite db");
    initialize_local_index_schema(&connection).expect("schema init should succeed");

    let normalized_query = normalize_search_query("needleterm");
    let mut statement = connection
      .prepare(
        "
          SELECT d.title
          FROM search_fts fts
          JOIN documents d
            ON d.path = fts.path
           AND d.root_path = fts.root_path
          WHERE fts.root_path = ?1
            AND search_fts MATCH ?2
        ",
      )
      .expect("should prepare search query");

    let titles = statement
      .query_map(params![stats.root_path, normalized_query], |row| row.get::<_, String>(0))
      .expect("query should succeed")
      .collect::<Result<Vec<_>, _>>()
      .expect("rows should decode");

    assert_eq!(titles, vec!["Budget".to_string()]);
  }
}
