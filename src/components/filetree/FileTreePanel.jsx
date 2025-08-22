import React, { useCallback } from 'react';
import { Plus, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tree, Folder, File, CollapseButton } from './filetree';

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
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); const name = window.prompt('New file name'); if (name) onAddFile({ parentId: node.id, name, content: '' }); }}>
                  <Plus className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); const name = window.prompt('New folder name'); if (name) onAddFolder({ parentId: node.id, name }); }}>
                  <FolderPlus className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); const name = window.prompt('Rename folder', node.name); if (name) onRename(node.id, name); }}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete folder "${node.name}"?`)) onDelete(node.id); }}>
                  <Trash2 className="size-4" />
                </Button>
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
            onClick={() => onSelect(node.id)}
          >
            <div className="flex items-center justify-between w-full pr-1">
              <span className="truncate">{node.name}</span>
              <span className="flex gap-1 ml-2">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); const name = window.prompt('Rename file', node.name); if (name) onRename(node.id, name); }}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete file "${node.name}"?`)) onDelete(node.id); }}>
                  <Trash2 className="size-4" />
                </Button>
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
          <Button variant="ghost" size="sm" onClick={addRootFile} title="New file">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={addRootFolder} title="New folder">
            <FolderPlus className="size-4" />
          </Button>
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