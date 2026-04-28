import type {
  CreateDocumentInput,
  DocumentRecord,
  MoveDocumentInput,
  SaveDocumentInput,
} from '../domain/storage'

export interface DocumentRepository {
  readDocument(path: string): Promise<DocumentRecord>
  createDocument(input: CreateDocumentInput): Promise<DocumentRecord>
  saveDocument(input: SaveDocumentInput): Promise<DocumentRecord>
  deleteDocument(path: string): Promise<void>
  moveDocument(input: MoveDocumentInput): Promise<DocumentRecord>
}
