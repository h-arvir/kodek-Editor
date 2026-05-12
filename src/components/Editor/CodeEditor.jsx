import Editor, { loader } from '@monaco-editor/react';

import '../../styles/Editor/CodeEditor.css';

import { memo, useState, useEffect, useRef } from 'react';
import { FaFolderTree } from "react-icons/fa6";
import { motion, AnimatePresence } from 'framer-motion';

import {
  VscTerminal,
  VscFeedback,
  VscCloudDownload,
} from 'react-icons/vsc';
import { IoMdSunny, IoMdMoon } from 'react-icons/io';
import { BsMic, BsCameraVideo, BsStars } from 'react-icons/bs';
import { AIFloatingBar } from '../AI/AIFloatingBar';
import { CommentThread } from '../Comments/CommentThread';

import NavDock from '../../../reactbits/NavDock';
import { ChatDock } from '../Chat/ChatDock';
import { AudioChat } from '../Audio/AudioChat';
import { VideoChat } from '../Audio/VideoChat';
import { useCollaboration } from '../../context/collabration';
import { useTheme } from '../../context/theme';

const configureMonacoThemes = (monaco) => {
  monaco.editor.defineTheme('kodek-light-grey', {
    base: 'vs', // Use VS light as the base
    inherit: true, // Inherit rules from the base theme
    rules: [], // No custom token rules
    colors: {
      // Set the editor background to light grey
      'editor.background': '#f0f0f0',
      'editor.foreground': '#333333',
      'editorLineNumber.foreground': '#666666',
      'editorCursor.foreground': '#9b5de5', // Primary color for cursor
      'editor.selectionBackground': 'rgba(155, 93, 229, 0.2)', // Primary color for selection
      'editor.inactiveSelectionBackground': 'rgba(155, 93, 229, 0.1)',
      'editorLineHighlight.background': '#e6f5fd', // Secondary color for line highlight
      'editor.lineHighlightBorder': '#d0f0fd', // Secondary color for line highlight border
    }
  });
};

export const CodeEditor = memo(
  ({
    language,
    code,
    handleCodeChange,
    handleEditorDidMount,
    isFullScreen,
    toggleFullScreen,
    runCode,
    isLoading,
    isFileTreeOpen,
    toggleFileTree,
    selectedFile,
    tree,
    addFile,
    setTree,
    isAIPanelOpen,
    toggleAIPanel,
    onAIAction,
    toggleTerminal,
    onToggleFileSearch,
    // ── Line comments ─────────────────────────
    comments,
    linesWithComments,
    onAddComment,
    onAddReply,
    onResolveThread,
    onDeleteThread,
    ...props
  }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [fontSize, setFontSize] = useState(14);
    const [isAudioChatOpen, setIsAudioChatOpen] = useState(false);
    const [isVideoChatOpen, setIsVideoChatOpen] = useState(false);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const [downloadStep, setDownloadStep] = useState('root');
    const [selectionInfo, setSelectionInfo] = useState(null);
    const [openThreadLine, setOpenThreadLine] = useState(null);
    const [threadPos, setThreadPos] = useState(null);

    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const commentDecsRef = useRef([]);
    const hoverDecsRef = useRef([]);
    const editorWrapperRef = useRef(null);
    // Keep a ref so scroll handler always has the latest openThreadLine
    const openThreadLineRef = useRef(null);

    const { unreadCount } = useCollaboration();
    const { toggleTheme, isDark } = useTheme();

    useEffect(() => {
      loader.init().then((m) => {
        configureMonacoThemes(m);
        monacoRef.current = m;
      });
    }, []);

    // Compute position for the comment thread panel (fixed coords)
    const computeThreadPos = (editor, line) => {
      const dom = editor.getContainerDomNode();
      if (!dom) return null;
      const rect = dom.getBoundingClientRect();
      const linePos = editor.getScrolledVisiblePosition({ lineNumber: line, column: 1 });
      if (!linePos || linePos.top < 0 || linePos.top > rect.height) return null;
      const lineHeight = editor.getOption(monacoRef.current?.editor?.EditorOption?.lineHeight ?? 66) || 20;
      return {
        top: rect.top + linePos.top + lineHeight,
        left: rect.left + 72,
        width: Math.min(460, rect.width - 84),
      };
    };

    const openThread = (editor, line) => {
      openThreadLineRef.current = line;
      setOpenThreadLine(line);
      setThreadPos(computeThreadPos(editor, line));
    };

    const closeThread = () => {
      openThreadLineRef.current = null;
      setOpenThreadLine(null);
      setThreadPos(null);
    };

    const wrappedEditorDidMount = (editor, monaco) => {
      configureMonacoThemes(monaco);
      monacoRef.current = monaco;
      if (!isDark) monaco.editor.setTheme('kodek-light-grey');
      if (handleEditorDidMount) handleEditorDidMount(editor, monaco);

      editorRef.current = editor;

      // ── Font size: Ctrl+= increase, Ctrl+- decrease ──────────────────────
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, () => {
        setFontSize((s) => Math.min(s + 1, 26));
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, () => {
        setFontSize((s) => Math.max(s - 1, 10));
      });

      // ── Ctrl+P → file search ─────────────────────────────────────────────
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
        if (typeof onToggleFileSearch === 'function') onToggleFileSearch();
      });

      // ── AI floating bar: selection tracking ──────────────────────────────
      editor.onDidChangeCursorSelection(() => {
        const sel = editor.getSelection();
        if (!sel || sel.isEmpty()) { setSelectionInfo(null); return; }
        const model = editor.getModel();
        if (!model) return;
        const selectedText = model.getValueInRange(sel);
        if (!selectedText.trim()) { setSelectionInfo(null); return; }
        const pixelPos = editor.getScrolledVisiblePosition(sel.getStartPosition());
        if (!pixelPos || pixelPos.top < 0) { setSelectionInfo(null); return; }
        setSelectionInfo({ text: selectedText, top: pixelPos.top, left: pixelPos.left });
      });

      editor.onDidBlurEditorWidget(() => {
        setTimeout(() => setSelectionInfo(null), 150);
      });

      // ── Line comment: hover indicator in gutter ──────────────────────────
      let hoveredGutterLine = -1;
      let rafId = null;

      const updateHoverDec = (line) => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (line === hoveredGutterLine) return;
          hoveredGutterLine = line;
          hoverDecsRef.current = editor.deltaDecorations(hoverDecsRef.current, line > 0 ? [{
            range: new monaco.Range(line, 1, line, 1),
            options: { glyphMarginClassName: 'comment-glyph--hover' },
          }] : []);
        });
      };

      editor.onMouseMove((e) => {
        const t = e.target.type;
        if (t === 2 || t === 3) { // GUTTER_GLYPH_MARGIN | GUTTER_LINE_NUMBERS
          updateHoverDec(e.target.position?.lineNumber ?? -1);
        } else {
          updateHoverDec(-1);
        }
      });

      editor.onMouseLeave(() => updateHoverDec(-1));

      // ── Line comment: gutter click to open/close thread ──────────────────
      editor.onMouseDown((e) => {
        const t = e.target.type;
        if (t === 2 || t === 3) {
          const line = e.target.position?.lineNumber;
          if (!line) return;
          if (openThreadLineRef.current === line) {
            closeThread();
          } else {
            openThread(editor, line);
          }
        }
      });

      // ── Reposition thread panel on editor scroll ─────────────────────────
      editor.onDidScrollChange(() => {
        const line = openThreadLineRef.current;
        if (!line) return;
        const pos = computeThreadPos(editor, line);
        if (pos) {
          setThreadPos(pos);
        } else {
          closeThread();
        }
      });
    };

    // Sync Monaco glyph decorations whenever commented lines change
    useEffect(() => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;

      const decorations = linesWithComments
        ? [...linesWithComments].map((line) => ({
            range: new monaco.Range(line, 1, line, 1),
            options: { glyphMarginClassName: 'comment-glyph--active' },
          }))
        : [];

      commentDecsRef.current = editor.deltaDecorations(commentDecsRef.current, decorations);
    }, [linesWithComments]);

    const handleFloatingBarAction = ({ action, customPrompt }) => {
      if (typeof onAIAction === 'function') {
        onAIAction({ action, selectedCode: selectionInfo?.text ?? '', customPrompt });
      }
      setSelectionInfo(null);
    };

    const commentsOnOpenLine = openThreadLine
      ? (comments ?? []).filter((c) => c.lineNumber === openThreadLine)
      : [];

    const items = [
      {
        icon: <VscTerminal size={18} />,
        label: 'Terminal',
        onClick: () => { if (typeof toggleTerminal === 'function') toggleTerminal(); },
      },
      {
        icon: (
          <div style={{ position: 'relative' }}>
            <VscFeedback size={18} />
            {unreadCount > 0 && (
              <span className="profile-button-badge">{unreadCount}</span>
            )}
          </div>
        ),
        label: 'Chat',
        onClick: () => setIsChatOpen(prev => !prev),
      },
      {
        icon: <BsMic size={18} />,
        label: 'Audio Chat',
        onClick: () => setIsAudioChatOpen(prev => !prev),
      },
      {
        icon: <BsCameraVideo size={18} />,
        label: 'Video Chat',
        onClick: () => setIsVideoChatOpen(prev => !prev),
      },
      {
        icon: <FaFolderTree size={18} />,
        label: isFileTreeOpen ? 'Hide File Tree' : 'Show File Tree',
        onClick: () => {
          if (typeof toggleFileTree === 'function') toggleFileTree();
        },
      },
      {
        icon: <VscCloudDownload size={18} />,
        label: 'Import/Export',
        onClick: () => {
          setDownloadStep('root');
          setIsDownloadMenuOpen((v) => !v)
        },
      },
      {
        icon: isDark ? <IoMdSunny size={18} /> : <IoMdMoon size={18} />,
        label: isDark ? 'Light Mode' : 'Dark Mode',
        onClick: toggleTheme,
      },
      {
        icon: <BsStars size={18} />,
        label: isAIPanelOpen ? 'Close AI Assistant' : 'AI Assistant',
        onClick: () => { if (typeof toggleAIPanel === 'function') toggleAIPanel(); },
      },
    ];

    return (
      <div className={`panel ${isFullScreen ? 'fullscreen' : ''}`}>
        <div className="panel-header">
          {!isFullScreen && (
            <span className="panel-header-title">
              Kodek Editor
              {selectedFile?.name && (
                <>
                  <span className="breadcrumb-sep"> / </span>
                  <span className="breadcrumb-file">{selectedFile.name}</span>
                </>
              )}
            </span>
          )}
          {isFullScreen && <span>Fullscreen Mode</span>}
          <motion.button
            className="button-secondary"
            onClick={toggleFullScreen}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {isFullScreen ?
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                </svg>
                <span>Exit Fullscreen</span>
              </>
            : <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
                <span>Fullscreen</span>
              </>
            }
          </motion.button>
          <motion.button
            className="button"
            onClick={runCode}
            disabled={isLoading}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {isLoading ?
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-spin"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                <span>Running...</span>
              </>
            : <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Run Code</span>
              </>
            }
          </motion.button>
        </div>
        <div className="editor-layout">
          <div className="dock-container">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <NavDock
                items={items}
                panelHeight={78}
                baseItemSize={60}
                magnification={75}
              />
            </motion.div>
            <div className="panels-stack">
              <AnimatePresence>
                {isChatOpen && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChatDock isOpen={true} setIsOpen={setIsChatOpen} />
                  </motion.div>
                )}
                {isAudioChatOpen && (
                  <motion.div
                    key="audio"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AudioChat 
                      isActive={true} 
                      onToggle={() => setIsAudioChatOpen(false)} 
                    />
                  </motion.div>
                )}
                {isVideoChatOpen && (
                  <motion.div
                    key="video"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <VideoChat 
                      isActive={true} 
                      onToggle={() => setIsVideoChatOpen(false)} 
                    />
                  </motion.div>
                )}
                {isDownloadMenuOpen && (
                  <motion.div
                    key="import-export"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="download-menu" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {downloadStep === 'root' && (
                        <>
                          <button className="button-secondary" onClick={() => setDownloadStep('import')}>
                            Import
                          </button>
                          <button className="button-secondary" onClick={() => setDownloadStep('export')}>
                            Export
                          </button>
                        </>
                      )}
                      {downloadStep === 'export' && (
                        <>
                          <button className="button-secondary" onClick={() => {
                            try {
                              if (selectedFile && selectedFile.name) {
                                const blob = new Blob([code ?? ''], { type: 'text/plain;charset=utf-8' });
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = selectedFile.name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(a.href);
                              }
                            } finally {
                              setIsDownloadMenuOpen(false);
                              setDownloadStep('root');
                            }
                          }}>
                            Export current file
                          </button>
                          <button className="button-secondary" onClick={() => {
                            import('jszip').then(({ default: JSZip }) => {
                              const zip = new JSZip();
                              const addNodes = (nodes, basePath = '') => {
                                if (!Array.isArray(nodes)) return;
                                for (const node of nodes) {
                                  const path = basePath ? `${basePath}/${node.name}` : node.name;
                                  if (node.type === 'folder') {
                                    zip.folder(path);
                                    if (node.children) addNodes(node.children, path);
                                  } else if (node.type === 'file') {
                                    const content = node.id === selectedFile?.id ? (code ?? '') : (node.content ?? '');
                                    zip.file(path, content);
                                  }
                                }
                              };
                              addNodes(tree);
                              zip.generateAsync({ type: 'blob' }).then((blob) => {
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = 'project.zip';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(a.href);
                              });
                            }).catch((e) => {
                              console.error('JSZip not available. Install with: npm i jszip', e);
                            }).finally(() => { setIsDownloadMenuOpen(false); setDownloadStep('root'); });
                          }}>
                            Export entire project (zip)
                          </button>
                        </>
                      )}
                      {downloadStep === 'import' && (
                        <>
                          {/* Hidden input for single file import */}
                          <input id="kodek-import-file" type="file" style={{ display: 'none' }} />
                          <button className="button-secondary" onClick={() => {
                            const input = document.getElementById('kodek-import-file');
                            if (!input) return;
                            input.onchange = async (e) => {
                              try {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const text = await file.text();
                                addFile({ name: file.name, content: text });
                              } catch (err) {
                                console.error('Failed to import file:', err);
                              } finally {
                                setIsDownloadMenuOpen(false);
                                setDownloadStep('root');
                                // reset input value to allow re-import same file name later
                                e.target.value = '';
                              }
                            };
                            input.click();
                          }}>
                            Import single file
                          </button>
                          {/* Hidden input for zip import */}
                          <input id="kodek-import-zip" type="file" accept=".zip,application/zip" style={{ display: 'none' }} />
                          <button className="button-secondary" onClick={() => {
                            const input = document.getElementById('kodek-import-zip');
                            if (!input) return;
                            input.onchange = async (e) => {
                              try {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const { default: JSZip } = await import('jszip');
                                const zip = await JSZip.loadAsync(file);
                                // Build a tree from zip entries
                                const root = [];
                                const dirMap = new Map(); // path -> node
                                const ensureDir = (path) => {
                                  if (!path) return null;
                                  if (dirMap.has(path)) return dirMap.get(path);
                                  const parts = path.split('/').filter(Boolean);
                                  let currentPath = '';
                                  let parentNode = null;
                                  for (const part of parts) {
                                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                                    let node = dirMap.get(currentPath);
                                    if (!node) {
                                      node = { id: Math.random().toString(36).slice(2,10), name: part, type: 'folder', children: [] };
                                      dirMap.set(currentPath, node);
                                      if (parentNode) parentNode.children.push(node); else root.push(node);
                                    }
                                    parentNode = node;
                                  }
                                  return parentNode;
                                };
                                await Promise.all(Object.keys(zip.files).map(async (name) => {
                                  const entry = zip.files[name];
                                  if (entry.dir) {
                                    ensureDir(name.replace(/\/$/, ''));
                                    return;
                                  }
                                  const folderPath = name.includes('/') ? name.substring(0, name.lastIndexOf('/')) : '';
                                  const baseName = name.substring(name.lastIndexOf('/') + 1);
                                  const parent = ensureDir(folderPath);
                                  const content = await entry.async('string');
                                  const fileNode = { id: Math.random().toString(36).slice(2,10), name: baseName, type: 'file', content };
                                  if (parent) parent.children.push(fileNode); else root.push(fileNode);
                                }));
                                // Replace entire tree with imported one
                                if (root.length > 0) setTree(root);
                              } catch (err) {
                                console.error('Failed to import zip:', err);
                              } finally {
                                setIsDownloadMenuOpen(false);
                                setDownloadStep('root');
                                e.target.value = '';
                              }
                            };
                            input.click();
                          }}>
                            Import project (zip)
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="editor-wrapper" ref={editorWrapperRef}>
            <AIFloatingBar
              visible={!!selectionInfo}
              position={selectionInfo}
              onAction={handleFloatingBarAction}
            />
            <Editor
              wrapperProps={{ ...props }}
              defaultLanguage={language}
              language={language}
              value={code}
              onChange={handleCodeChange}
              theme={isDark ? "vs-dark" : "kodek-light-grey"}
              onMount={wrappedEditorDidMount}
              options={{
                fontSize: fontSize,
                fontFamily: "'Fira Code', 'Consolas', monospace",
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                glyphMargin: true,
                roundedSelection: true,
                padding: { top: 16, bottom: 16 },
                cursorStyle: 'line',
                cursorWidth: 2,
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                tabSize: 2,
                automaticLayout: true,
                wordWrap: 'on',
                renderLineHighlight: 'all',
                ...(isDark ? {} : { backgroundColor: '#f0f0f0' }),
                scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                  vertical: 'visible',
                  horizontal: 'visible',
                  verticalHasArrows: false,
                  horizontalHasArrows: false,
                  useShadows: false,
                },
              }}
            />
            {/* Inline comment thread panel — fixed positioning computed from editor coords */}
            {openThreadLine && threadPos && (
              <CommentThread
                lineNumber={openThreadLine}
                position={threadPos}
                commentsOnLine={commentsOnOpenLine}
                onAddComment={onAddComment}
                onAddReply={onAddReply}
                onResolveThread={onResolveThread}
                onDeleteThread={onDeleteThread}
                onClose={closeThread}
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);

CodeEditor.displayName = 'Code Editor';
