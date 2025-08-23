import Editor, { loader } from '@monaco-editor/react';

import '../../styles/Editor/CodeEditor.css';

import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  VscTerminalPowershell,
  VscFeedback,
  VscComment,
  VscFolder,
  VscCloudDownload,
  } from 'react-icons/vsc';
import { IoMdSunny, IoMdMoon } from 'react-icons/io';
import { BsMic, BsCameraVideo } from 'react-icons/bs';

import Dock from '../../../reactbits/dock';
import { ChatDock } from '../Chat/ChatDock';
import { AudioChat } from '../Audio/AudioChat';
import { VideoChat } from '../Audio/VideoChat';
import { useCollaboration } from '../../context/collabration';
import { useTheme } from '../../context/theme';

// Define a function to configure custom Monaco themes
const configureMonacoThemes = (monaco) => {
  console.log('Configuring Monaco themes...');
  
  // Define a custom light theme with grey background
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
  
  console.log('Custom theme defined: kodek-light-grey');
};

export const CodeEditor = memo(
  ({
    language,
    code,
    handleCodeChange,
    handleEditorDidMount,
    isFullScreen,
    toggleFullScreen,
    toggleOutput,
    runCode,
    isLoading,
    isFileTreeOpen,
    toggleFileTree,
    selectedFile,
    tree,
    addFile,
    setTree,
    ...props
  }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isAudioChatOpen, setIsAudioChatOpen] = useState(false);
    const [isVideoChatOpen, setIsVideoChatOpen] = useState(false);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const [downloadStep, setDownloadStep] = useState('root'); // 'root' | 'import' | 'export'
    // file tree visibility is controlled by parent via props
    const { unreadCount } = useCollaboration();
    const { theme, toggleTheme, isDark } = useTheme();
    
    // Configure Monaco themes when the component mounts
    useEffect(() => {
      // Configure Monaco themes when loader is ready
      loader.init().then(monaco => {
        configureMonacoThemes(monaco);
      });
    }, []);
    
    // Wrap the original handleEditorDidMount to ensure our theme is applied
    const wrappedEditorDidMount = (editor, monaco) => {
      console.log('Editor mounted, applying custom theme...');
      
      // Apply our custom theme configuration
      configureMonacoThemes(monaco);
      
      // Explicitly set the theme on the editor instance if in light mode
      if (!isDark) {
        console.log('Setting editor theme to kodek-light-grey');
        monaco.editor.setTheme('kodek-light-grey');
      }
      
      // Call the original handleEditorDidMount if provided
      if (handleEditorDidMount) {
        handleEditorDidMount(editor, monaco);
      }
    };
    
    // Handle the toggle output with additional debugging
    const handleToggleOutput = () => {
      console.log('toggle button clicked!');
      if (typeof toggleOutput === 'function') {
        toggleOutput();
      } else {
        console.error('toggleOutput is not a function');
      }
    };
    
    // Handle the profile button click to toggle chat
    const handleProfileClick = () => {
      console.log('chat button clicked!');
      setIsChatOpen(!isChatOpen);
    };
    
    // Handle the audio chat button click
    const handleAudioChatClick = () => {
      console.log('audio chat button clicked!');
      setIsAudioChatOpen(!isAudioChatOpen);
    };
    
    // Handle the video chat button click
    const handleVideoChatClick = () => {
      console.log('video chat button clicked!');
      setIsVideoChatOpen(!isVideoChatOpen);
    };

    const items = [
      // {
      //   icon: <VscHome size={18} />,
      //   label: 'Home',
      //   onClick: () => alert('Home!'),
      // },
      {
        icon: <VscTerminalPowershell size={18} />,
        label: 'Toggle Output',
        onClick: handleToggleOutput,
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
        onClick: handleProfileClick,
      },
      {
        icon: <BsMic size={18} />,
        label: 'Audio Chat',
        onClick: handleAudioChatClick,
      },
      {
        icon: <BsCameraVideo size={18} />,
        label: 'Video Chat',
        onClick: handleVideoChatClick,
      },
      {
        icon: <VscFolder size={18} />,
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
    ];

    return (
      <div className={`panel ${isFullScreen ? 'fullscreen' : ''}`}>
        <div className="panel-header">
          {!isFullScreen && <span>Kodek Editor</span>}
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
              <Dock
                items={items}
                panelHeight={68}
                baseItemSize={50}
                magnification={50}
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
                          <button className="button" onClick={() => setDownloadStep('import')}>
                            Import
                          </button>
                          <button className="button-secondary" onClick={() => setDownloadStep('export')}>
                            Export
                          </button>
                        </>
                      )}
                      {downloadStep === 'export' && (
                        <>
                          <button className="button" onClick={() => {
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
                          <button className="button" onClick={() => {
                            const input = document.getElementById('kodek-import-file');
                            if (!input) return;
                            input.onchange = async (e) => {
                              try {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const text = await file.text();
                                const added = addFile({ name: file.name, content: text });
                                // Select newly added file via addFile’s side-effect
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
                                  let currentChildren = root;
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
          <div className="editor-wrapper">
            <Editor
              wrapperProps={{ ...props }}
              defaultLanguage={language}
              language={language}
              value={code}
              onChange={handleCodeChange}
              theme={isDark ? "vs-dark" : "kodek-light-grey"}
              onMount={wrappedEditorDidMount}
              options={{
                fontSize: 14,
                fontFamily: "'Fira Code', 'Consolas', monospace",
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
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
                // Set the background color directly in the editor options
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
          </div>
        </div>
      </div>
    );
  },
);

CodeEditor.displayName = 'Code Editor';
