// Backward-compat re-export — старые страницы импортировали `@/lib/folder-store`.
// Новый источник правды — `@/lib/context-store` (Org/Cloud/Folder breadcrumb).
//
// Существующий API остаётся:
//   useFolderStore(s => s.folder) → FolderRef | null
//   folderStoreApi.set(folder)
export { folderStoreApi, useFolderStore } from "./context-store";
export type { FolderRef } from "./context-store";
