import React, { useCallback } from 'react';
import { Plus, FolderPlus, Pencil, Trash2 } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tree, Folder, File, CollapseButton } from './filetree';

// Simple icon-only clickable component
const IconBtn = ({ onClick, title, children }) => (
  <span
    role="button"
    tabIndex={0}
    title={title}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e); } }}
    className="inline-flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer select-none"
  >
    {children}
  </span>
);

// Helper to render the tree recursively
function TreeNodes({ nodes, selectedId, onSelect, onAddFile, onAddFolder, onRename, onDelete }) {
  return (
    <>
      {nodes.map((node) =>
        node.type === 'folder' ? (
          <Folder key={node.id} value={node.id} element={
            <div className="flex items-center justify-between w-full">
              <span className="truncate">{node.name}</span>
              <span className="flex gap-1 ml-2">
                <IconBtn title="New file" onClick={(e) => { e.stopPropagation(); const name = window.prompt('New file name'); if (name) onAddFile({ parentId: node.id, name, content: '' }); }}>
                  <Plus className="size-4" />
                </IconBtn>
                <IconBtn title="New folder" onClick={(e) => { e.stopPropagation(); const name = window.prompt('New folder name'); if (name) onAddFolder({ parentId: node.id, name }); }}>
                  <FolderPlus className="size-4" />
                </IconBtn>
                <IconBtn title="Rename folder" onClick={(e) => { e.stopPropagation(); const name = window.prompt('Rename folder', node.name); if (name) onRename(node.id, name); }}>
                  <Pencil className="size-4" />
                </IconBtn>
                <IconBtn title="Delete folder" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete folder \"${node.name}\"?`)) onDelete(node.id); }}>
                  <Trash2 className="size-4" />
                </IconBtn>
              </span>
            </div>
          }>
            {node.children && node.children.length > 0 && (
              <TreeNodes
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                onAddFile={onAddFile}
                onAddFolder={onAddFolder}
                onRename={onRename}
                onDelete={onDelete}
              />
            )}
          </Folder>
        ) : (
          <File
            key={node.id}
            value={node.id}
            isSelect={selectedId === node.id}
          >
            <div className="flex items-center justify-between w-full pr-1">
              <span
                role="button"
                tabIndex={0}
                className="truncate cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node.id); } }}
              >
                {node.name}
              </span>
              <span className="flex gap-1 ml-2">
                <IconBtn title="Rename file" onClick={(e) => { e.stopPropagation(); const name = window.prompt('Rename file', node.name); if (name) onRename(node.id, name); }}>
                  <Pencil className="size-4" />
                </IconBtn>
                <IconBtn title="Delete file" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete file \"${node.name}\"?`)) onDelete(node.id); }}>
                  <Trash2 className="size-4" />
                </IconBtn>
              </span>
            </div>
          </File>
        ),
      )}
    </>
  );
}

export function FileTreePanel({
  tree,
  selectedId,
  onSelect,
  onAddFile,
  onAddFolder,
  onRename,
  onDelete,
}) {
  const addRootFile = useCallback(() => {
    const name = window.prompt('New file name');
    if (name) onAddFile({ name, parentId: null, content: '' });
  }, [onAddFile]);

  const addRootFolder = useCallback(() => {
    const name = window.prompt('New folder name');
    if (name) onAddFolder({ name, parentId: null });
  }, [onAddFolder]);

  return (
    <div className="h-full flex flex-col border-r bg-background">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-medium">Files</span>
        <div className="flex gap-1">
          <IconBtn title="New file" onClick={addRootFile}>
            <Plus className="size-4" />
          </IconBtn>
          <IconBtn title="New folder" onClick={addRootFolder}>
            <FolderPlus className="size-4" />
          </IconBtn>
        </div>
      </div>
      <ScrollArea className="flex-1 relative">
        <Tree elements={tree} className="p-1">
          <TreeNodes
            nodes={tree}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddFile={onAddFile}
            onAddFolder={onAddFolder}
            onRename={onRename}
            onDelete={onDelete}
          />
          <CollapseButton elements={tree}>
            Toggle
          </CollapseButton>
        </Tree>
      </ScrollArea>
    </div>
  );
}