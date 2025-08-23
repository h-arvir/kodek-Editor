import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCollaboration } from '@/context/collabration';

// Simple id generator
const makeId = () => Math.random().toString(36).slice(2, 10);

// const STORAGE_KEY = 'kodek_files_v1';

// Node shape:
// { id, name, type: 'file' | 'folder', children?: Node[], content?: string }

// Local storage disabled for collaborative mode
function loadFromStorage() {
  return null;
}

function saveToStorage(data) {
  // no-op
}

function findNode(root, id) {
  if (!root) return null;
  if (Array.isArray(root)) {
    for (const node of root) {
      const found = findNode(node, id);
      if (found) return found;
    }
    return null;
  }
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

function updateTree(nodes, predicate, updater) {
  return nodes.map((node) => {
    if (predicate(node)) {
      return updater({ ...node });
    }
    if (node.children) {
      return { ...node, children: updateTree(node.children, predicate, updater) };
    }
    return node;
  });
}

function removeFromTree(nodes, id) {
  const result = [];
  for (const node of nodes) {
    if (node.id === id) continue;
    if (node.children) {
      result.push({ ...node, children: removeFromTree(node.children, id) });
    } else {
      result.push(node);
    }
  }
  return result;
}

function insertIntoTree(nodes, parentId, item) {
  if (!parentId) return [...nodes, item];
  return nodes.map((node) => {
    if (node.id === parentId && node.type === 'folder') {
      const children = node.children ? [...node.children, item] : [item];
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: insertIntoTree(node.children, parentId, item) };
    }
    return node;
  });
}

export function useProjectFiles() {
  const { joinedRoom, roomId, socket, selfInfo } = useCollaboration();
  const [tree, setTree] = useState(() => {
    // Default project with a src folder and a file
    return [
      {
        id: makeId(),
        name: 'src',
        type: 'folder',
        children: [
          {
            id: makeId(),
            name: 'main.js',
            type: 'file',
            content: "// Your first file!\nconsole.log('Hello from Kodek Project Files');",
          },
        ],
      },
    ];
  });

  const [selectedFileId, setSelectedFileId] = useState(null);

  const isApplyingRemoteRef = useRef(false);

  useEffect(() => {
    saveToStorage(tree);
    if (isApplyingRemoteRef.current) {
      // Do not broadcast when applying a remote update
      isApplyingRemoteRef.current = false;
      return;
    }
    if (joinedRoom && roomId && socket && selfInfo) {
      socket.emit('filesTreeUpdate', { roomId, userId: selfInfo.id, tree });
    }
  }, [tree, joinedRoom, roomId, socket, selfInfo]);

  const selectedFile = useMemo(() => {
    if (!selectedFileId) return null;
    const node = findNode(tree, selectedFileId);
    return node && node.type === 'file' ? node : null;
  }, [tree, selectedFileId]);

  // Listen for remote tree updates and initial state
  useEffect(() => {
    if (!socket) return;

    const handleRemoteTreeUpdate = ({ userId, tree: incoming }) => {
      if (!incoming || !Array.isArray(incoming)) return;
      if (selfInfo && userId === selfInfo.id) return; // ignore own
      isApplyingRemoteRef.current = true;
      setTree(incoming);
    };

    const handleInitialFilesState = ({ tree: incoming }) => {
      if (!incoming || !Array.isArray(incoming)) return;
      isApplyingRemoteRef.current = true;
      setTree(incoming);
    };

    const handleRequestFilesState = ({ requesterId }) => {
      if (!joinedRoom || !roomId) return;
      socket.emit('shareFilesState', { roomId, requesterId, tree });
    };

    socket.on('filesTreeUpdate', handleRemoteTreeUpdate);
    socket.on('initialFilesState', handleInitialFilesState);
    socket.on('requestFilesState', handleRequestFilesState);

    return () => {
      socket.off('filesTreeUpdate', handleRemoteTreeUpdate);
      socket.off('initialFilesState', handleInitialFilesState);
      socket.off('requestFilesState', handleRequestFilesState);
    };
  }, [socket, selfInfo, joinedRoom, roomId, tree]);

  const addFile = useCallback(({ name, parentId = null, content = '' }) => {
    const item = { id: makeId(), name, type: 'file', content };
    setTree((prev) => insertIntoTree(prev, parentId, item));
    setSelectedFileId(item.id);
    return item;
  }, []);

  const addFolder = useCallback(({ name, parentId = null }) => {
    const item = { id: makeId(), name, type: 'folder', children: [] };
    setTree((prev) => insertIntoTree(prev, parentId, item));
    return item;
  }, []);

  const renameItem = useCallback((id, newName) => {
    setTree((prev) => updateTree(prev, (n) => n.id === id, (n) => ({ ...n, name: newName })));
  }, []);

  const deleteItem = useCallback((id) => {
    setTree((prev) => removeFromTree(prev, id));
    if (selectedFileId === id) setSelectedFileId(null);
  }, [selectedFileId]);

  const setFileContent = useCallback((id, content) => {
    setTree((prev) =>
      updateTree(prev, (n) => n.id === id && n.type === 'file', (n) => ({ ...n, content })),
    );
  }, []);

  const selectFile = useCallback((id) => setSelectedFileId(id), []);

  // When joining a room as host, share our files state when requested
  useEffect(() => {
    if (!socket) return;
    const handleRequestFilesState = ({ requesterId }) => {
      if (!joinedRoom || !roomId) return;
      socket.emit('shareFilesState', { roomId, requesterId, tree });
    };
    socket.on('requestFilesState', handleRequestFilesState);
    return () => socket.off('requestFilesState', handleRequestFilesState);
  }, [socket, joinedRoom, roomId, tree]);

  return {
    tree,
    setTree,
    selectedFileId,
    selectedFile,
    addFile,
    addFolder,
    renameItem,
    deleteItem,
    setFileContent,
    selectFile,
  };
}