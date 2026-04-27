use serde::Serialize;
use std::{
  collections::HashMap,
  fs,
  path::{Path, PathBuf},
  time::SystemTime,
};
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
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      scan_vault,
      read_document,
      create_document,
      save_document,
      delete_document,
      move_document
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
}
