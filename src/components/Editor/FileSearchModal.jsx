import { useEffect, useMemo, useRef, useState } from 'react';
import { VscFile } from 'react-icons/vsc';
import '../../styles/Editor/FileSearchModal.css';

function flattenTree(nodes, parentPath = '') {
  const results = [];
  if (!Array.isArray(nodes)) return results;
  for (const node of nodes) {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.type === 'file') {
      results.push({ id: node.id, name: node.name, path: fullPath });
    } else if (node.children) {
      results.push(...flattenTree(node.children, fullPath));
    }
  }
  return results;
}

export function FileSearchModal({ isOpen, onClose, tree, onSelect }) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const allFiles = useMemo(() => flattenTree(tree ?? []), [tree]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allFiles.slice(0, 50);
    return allFiles
      .filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 50);
  }, [query, allFiles]);

  useEffect(() => {
    setActiveIdx(0);
  }, [results]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  useEffect(() => {
    const el = listRef.current?.children[activeIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[activeIdx]) {
        onSelect(results[activeIdx].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="file-search-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="file-search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="file-search-input"
          placeholder="Search files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="file-search-results" ref={listRef}>
          {results.length === 0 ? (
            <div className="file-search-empty">No files match "{query}"</div>
          ) : (
            results.map((file, i) => (
              <button
                key={file.id}
                className={`file-search-item${i === activeIdx ? ' file-search-item--active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => { onSelect(file.id); onClose(); }}
              >
                <VscFile size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                <span className="file-search-item-name">{file.name}</span>
                {file.path !== file.name && (
                  <span className="file-search-item-path">{file.path}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
