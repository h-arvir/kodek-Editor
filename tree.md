# Project File Tree, Import/Export, and GitHub Integration Plan

## Goals
- **Import/Export coding files**: Support importing individual files/folders and exporting single files or the entire project (as .zip or using native File System Access API).
- **VS Code–like file tree**: Browse, create, rename, delete, move (drag & drop), and open files/folders inside a project.
- **GitHub integration**: Sign in with GitHub, import repositories or folders directly, and export/push project changes back to GitHub.

## High-Level Architecture
- **Virtual File System (VFS)** in the frontend to represent a project and enable fast tree operations.
  - Tree nodes for folders/files with IDs; content stored separately and referenced by ID for performance.
  - Paths derived from parent → child relations to avoid repeated string operations.
- **State management**: React Context + Reducer for project state (ProjectContext), persisted to IndexedDB for session restore.
- **Adapters** for I/O:
  - **Local FS Adapter**: Browser File System Access API (with fallbacks via input[type=file]/download links).
  - **Zip Adapter**: Import/export entire project using JSZip.
  - **GitHub Adapter**: Use Octokit + backend OAuth to read/write repos.

## Data Model
```ts
// src/types/files.ts
export type NodeID = string;
export type NodeType = 'file' | 'folder';

export interface FileNode {
  id: NodeID;
  name: string;
  type: NodeType;
  parentId: NodeID | null; // null for root
  children?: NodeID[];     // for folders
  // Optional metadata
  createdAt?: number;
  updatedAt?: number;
}

export interface FileContent {
  id: NodeID;      // same as node id
  mime?: string;   // 'text/javascript', 'text/css', etc.
  text?: string;   // for text files
  blob?: Blob;     // for binary assets
}

export interface ProjectState {
  rootId: NodeID;
  nodes: Record<NodeID, FileNode>;
  contents: Record<NodeID, FileContent>;
  openFileId: NodeID | null;
  expanded: Record<NodeID, boolean>;
}
```

## Project Context (Reducer API)
Actions to support:
- **createFile(folderId, name, initialContent?)**
- **createFolder(folderId, name)**
- **rename(nodeId, newName)**
- **delete(nodeId)** (recursively for folders)
- **move(nodeId, targetFolderId, index?)** (drag & drop)
- **setOpenFile(nodeId)**, **updateContent(nodeId, text|blob)**
- **importFromFS(entries)**, **exportToFS(mode: 'file'|'project')**
- **importZip(file)**, **exportZip()**
- **githubImport(params)**, **githubExport(params)**

Persist to IndexedDB using `idb-keyval` or `localforage` to restore last project.

## UI Components
- **FileTree**: Collapsible tree view with context menu.
- **TreeNode**: Single node line item with icon, name, inline rename.
- **TreeToolbar**: Buttons: New File, New Folder, Import, Export, GitHub.
- **Modals**: New file/folder, Rename, Confirm delete, Import from GitHub.
- **Drag & Drop**: Use `@dnd-kit/core` for reordering/moving between folders.

Suggested structure:
```
src/components/FileTree/
  FileTree.jsx
  TreeNode.jsx
  TreeToolbar.jsx
  contextMenu.jsx
```

## Libraries
- **Drag & drop**: `@dnd-kit/core`
- **Zip**: `jszip`
- **Persistence**: `idb-keyval` or `localforage`
- **GitHub API**: `@octokit/rest`
- **Icons**: `lucide-react` or similar

## Local Import/Export (Browser)
1. **Import files/folder**
   - Try File System Access API (`showOpenFilePicker`, `showDirectoryPicker`).
   - Fallback: `<input type="file" webkitdirectory multiple>` to get a folder recursively.
   - Normalize entries → VFS nodes + contents; infer MIME by extension.
2. **Export**
   - If FS Access available available: `showSaveFilePicker` for single file and `FileSystemDirectoryHandle` for folder sync.
   - Fallback: Generate .zip with JSZip and trigger download.

## GitHub Integration
- **Auth flow** (server-side in `server/index.js`):
  1. Create a GitHub OAuth App (client_id, client_secret). Callback: `/auth/github/callback`.
  2. Endpoints:
     - `GET /auth/github/login` → redirect to GitHub.
     - `GET /auth/github/callback` → exchange code → session cookie/JWT.
     - `GET /github/repos` → list user repos.
     - `GET /github/trees` → fetch repo tree (by repo/branch/path) or download zipball.
     - `POST /github/commit` → commit a set of file changes using Git Data API (create blobs, trees, commit, update ref).
- **Frontend**:
  - Button "Sign in with GitHub"; store auth state.
  - "Import from GitHub" modal: select repo → branch → path; choose API: tree or zip.
  - "Export to GitHub" modal: repo/branch/path; summary of changes; confirm commit message.
- **Implementation notes**:
  - For import, safest is downloading repo zipball and mapping entries → VFS.
  - For export, use Git Data API to create blobs/trees and update the head ref (no need to shell out to git).
  - Handle binary assets with base64 blobs.

## Example Backend Snippets (Node/Express)
```js
// server/index.js (sketch)
import express from 'express';
import fetch from 'node-fetch';
import session from 'express-session';
import { Octokit } from '@octokit/rest';

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(session({ secret: process.env.SESSION_SECRET || 'dev', resave: false, saveUninitialized: false }));

app.get('/auth/github/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GH_CLIENT_ID,
    scope: 'repo read:user'
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code;
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.GH_CLIENT_ID, client_secret: process.env.GH_CLIENT_SECRET, code })
  }).then(r => r.json());
  req.session.ghToken = tokenRes.access_token;
  res.redirect('/');
});

function octokit(req) {
  return new Octokit({ auth: req.session.ghToken });
}

app.get('/github/repos', async (req, res) => {
  const o = octokit(req);
  const { data } = await o.repos.listForAuthenticatedUser({ per_page: 100 });
  res.json(data);
});

// Minimal commit endpoint (files: [{path, content(base64), sha?}])
app.post('/github/commit', async (req, res) => {
  const { owner, repo, branch, message, files } = req.body;
  const o = octokit(req);
  // 1) Get base ref
  const { data: ref } = await o.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const baseSha = ref.object.sha;
  // 2) Create blobs
  const blobs = await Promise.all(files.map(f => o.git.createBlob({ owner, repo, content: f.content, encoding: 'base64' })));
  // 3) Create tree
  const tree = files.map((f, i) => ({ path: f.path, mode: '100644', type: 'blob', sha: blobs[i].data.sha }));
  const { data: newTree } = await o.git.createTree({ owner, repo, base_tree: baseSha, tree });
  // 4) Create commit
  const { data: commit } = await o.git.createCommit({ owner, repo, message, tree: newTree.sha, parents: [baseSha] });
  // 5) Update ref
  await o.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  res.json({ ok: true, commit: commit.sha });
});

export default app;
```

## File Tree Component Sketch
```tsx
// src/components/FileTree/FileTree.jsx
import React from 'react';
import { useProject } from '../../context/project';

export default function FileTree() {
  const { state, actions } = useProject();
  const root = state.nodes[state.rootId];
  return (
    <div className="file-tree">
      <TreeNode id={root.id} depth={0} />
    </div>
  );
}

function TreeNode({ id, depth }) {
  const { state, actions } = useProject();
  const node = state.nodes[id];
  const isFolder = node.type === 'folder';
  const expanded = state.expanded[id];
  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div className="node" onDoubleClick={() => isFolder ? actions.toggleExpand(id) : actions.setOpenFile(id)}>
        {isFolder ? (expanded ? '📂' : '📁') : '📄'} {node.name}
      </div>
      {isFolder && expanded && node.children?.map(cid => (
        <TreeNode key={cid} id={cid} depth={depth + 1} />
      ))}
    </div>
  );
}
```

## Tasks & Milestones
1. **VFS + Context**
   - Define types, reducer, actions, and persistence.
   - Integrate with existing editor open/save flows.
2. **FileTree UI (read-only)**
   - Expand/collapse, open file in editor.
3. **Mutations + DnD**
   - New file/folder, rename, delete, and drag & drop move.
   - Context menu and keyboard shortcuts (F2, Del, Ctrl+N, etc.).
4. **Local Import/Export**
   - Implement FS Access API + fallback input/zip.
5. **Zip Import/Export**
   - Add JSZip for whole-project export/import.
6. **GitHub OAuth (server)**
   - Add endpoints; store token in session.
7. **GitHub Import**
   - Repo picker → branch → path; zipball or tree API; map to VFS.
8. **GitHub Export**
   - Build changed files list → commit via Git Data API.
9. **Polish & QA**
   - Edge cases: duplicate names, large repos, binary assets, path conflicts.

## Edge Cases & Notes
- **Name conflicts**: auto-append suffix or prompt user.
- **Binary files**: store as Blob; avoid treating as text.
- **Large repos**: prefer zipball download; paginate API calls.
- **Path rules**: sanitize `..`, illegal characters, trailing spaces.
- **Permissions**: minimal GitHub scopes; tokens never sent to client except via session.

## Estimated Timeline
- **Week 1**: VFS + FileTree read-only + basic mutations.
- **Week 2**: Local import/export + zip; polish DnD.
- **Week 3**: GitHub OAuth + Import from repo.
- **Week 4**: Export to GitHub (commits) + QA.

## Next Steps
1. Create `ProjectContext` skeleton and mount `FileTree` in the left sidebar.
2. Add Toolbar buttons for Import/Export and GitHub.
3. Implement Zip import/export with JSZip.
4. Wire GitHub OAuth endpoints in `server/index.js` and test with a test repo.
5. Iterate on DnD and context menus for a VS Code–like feel.