import React, { useCallback, useState } from 'react';
import { Plus, FolderPlus, Pencil, Trash2, MoreHorizontal, Eye } from 'lucide-react';

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
  // Track which row's actions are visible; by id
  const [openActions, setOpenActions] = useState(new Set());
  const toggleActions = (id) => {
    setOpenActions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  return (
    <>
      {nodes.map((node) =>
        node.type === 'folder' ? (
          <Folder key={node.id} value={node.id} element={
            <div className="flex items-center justify-between w-full pr-1">
              <span className="truncate">{node.name}</span>
              <span className="flex items-center gap-1 ml-2">
                {openActions.has(node.id) && (
                  <>
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
                  </>
                )}
                <IconBtn title={openActions.has(node.id) ? 'Hide actions' : 'Show actions'} onClick={(e) => { e.stopPropagation(); toggleActions(node.id); }}>
                  <MoreHorizontal className="size-4" />
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
              <span className="flex items-center gap-1 ml-2">
                {openActions.has(node.id) && (
                  <>
                    <IconBtn title="Rename file" onClick={(e) => { e.stopPropagation(); const name = window.prompt('Rename file', node.name); if (name) onRename(node.id, name); }}>
                      <Pencil className="size-4" />
                    </IconBtn>
                    <IconBtn title="Delete file" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete file \"${node.name}\"?`)) onDelete(node.id); }}>
                      <Trash2 className="size-4" />
                    </IconBtn>
                  </>
                )}
                <IconBtn title={openActions.has(node.id) ? 'Hide actions' : 'Show actions'} onClick={(e) => { e.stopPropagation(); toggleActions(node.id); }}>
                  <MoreHorizontal className="size-4" />
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

      <ScrollArea className="flex-1 relative">
        <Tree elements={tree} className="p-1">
          {/* Sticky header inside Tree to stay within TreeContext */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 mb-1 border-b px-1 py-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-small">FileTree</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Eye toggle icon, using lucide-react for consistency */}
              <CollapseButton
                elements={tree}
                className="!p-0 text-muted-foreground hover:text-foreground outline-none focus:outline-none focus:ring-0"
                aria-label="Toggle"
                title="Toggle"
              >
                <Eye className="size-4" />
              </CollapseButton>
              <IconBtn title="New file" onClick={addRootFile}>
                <Plus className="size-4" />
              </IconBtn>
              <IconBtn title="New folder" onClick={addRootFolder}>
                <FolderPlus className="size-4" />
              </IconBtn>
              
            </div>
          </div>

          <TreeNodes
            nodes={tree}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddFile={onAddFile}
            onAddFolder={onAddFolder}
            onRename={onRename}
            onDelete={onDelete}
          />
        </Tree>
      </ScrollArea>
    </div>
  );
}