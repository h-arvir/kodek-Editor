import { useCallback, useEffect, useRef, useState } from 'react';
import { Resizable } from 're-resizable';

import './styles/common/variables.css';
import './styles/common/buttons.css';
import './styles/common/themes.css';
import './styles/App.css';

import { RemoteCursors, useMouseProps } from '@/components/ui/remote-cursors';

import { JoinRoom } from './components/Auth/JoinRoom';
import { CodeEditor } from './components/Editor/CodeEditor';
import { Header } from './components/Layout/Header';
import { AIPanel } from './components/AI/AIPanel';
import { useCollaboration } from './context/collabration';
import { ThemeProvider } from './context/theme';
import { useCodeExecution } from './hooks/useCodeExecution';
import { useEditor } from './hooks/useEditor';
import { useProjectFiles } from './hooks/useProjectFiles';
import { useAIAssistant } from './hooks/useAIAssistant';
import { useLineComments } from './hooks/useLineComments';
import { FileTreePanel } from './components/filetree/FileTreePanel';
import { EmbeddedTerminal } from './components/Terminal/EmbeddedTerminal';
import { FileSearchModal } from './components/Editor/FileSearchModal';
import { WaitingRoom } from './components/Room/WaitingRoom';
import { AdmissionPopup } from './components/Room/AdmissionPopup';
import { LANGUAGE_OPTIONS } from './utils/constants';

/**
 * Main application component
 */
function App() {
  const [language, setLanguage] = useState('javascript');
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiSelectedCode, setAiSelectedCode] = useState('');
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [hasOpenedTerminal, setHasOpenedTerminal] = useState(false);
  const [isFileSearchOpen, setIsFileSearchOpen] = useState(false);

  // Initialize collaboration features
  const {
    isConnected,
    joinedRoom,
    roomId,
    username,
    setUsername,
    setRoomId,
    joinRoom,
    connectionError,
    usernameError,
    activeUsers,
    selfInfo,
    handleLanguageChange: propagateLanguageChange,
    shareInitialState,
    initialStateRef,
    // Room permissions
    isWaiting,
    canEdit,
    joinRequests,
    setJoinRequests,
    admitUser,
    denyUser,
    kickUser,
    banUser,
    setPermission,
  } = useCollaboration();

  // Initialize editor hook
  const {
    code,
    isFullScreen,
    handleEditorDidMount,
    handleCodeChange,
    editorInstance,
    toggleFullScreen,
  } = useEditor({
    initialCode: LANGUAGE_OPTIONS[language].defaultCode,
  });

  // Project files state (local, per user)
  const {
    tree,
    setTree,
    selectedFile,
    selectedFileId,
    addFile,
    addFolder,
    renameItem,
    deleteItem,
    setFileContent,
    selectFile,
  } = useProjectFiles();

  const currentCodeRef = useRef(code); // Ref to track current code for comparison

  const mouseMoveProps = useMouseProps();

  const toggleFileTree = useCallback(() => {
    setIsFileTreeOpen(prev => !prev);
  }, []);

  // Terminal ref — callback form so we can flush queued writes on mount
  const terminalRef           = useRef(null);
  const pendingTerminalWrites = useRef([]);

  const terminalCallbackRef = useCallback((instance) => {
    terminalRef.current = instance;
    if (instance && pendingTerminalWrites.current.length > 0) {
      pendingTerminalWrites.current.forEach((t) => instance.write(t));
      pendingTerminalWrites.current = [];
    }
  }, []);

  // Called by useCodeExecution whenever new output is ready
  const onNewOutput = useCallback((text) => {
    setIsTerminalOpen(true);
    setHasOpenedTerminal(true);
    if (terminalRef.current) {
      terminalRef.current.write(text);
    } else {
      pendingTerminalWrites.current.push(text);
    }
  }, []);

  // Initialize code execution
  const {
    output,
    setOutput,
    isLoading,
    runCode,
  } = useCodeExecution({ onNewOutput });

  // AI Assistant
  const {
    settings: aiSettings,
    updateSettings: updateAISettings,
    response: aiResponse,
    isStreaming: aiIsStreaming,
    error: aiError,
    sendMessage: aiSendMessage,
    stopStreaming: aiStop,
    clearResponse: aiClearResponse,
  } = useAIAssistant();

  const toggleAIPanel = useCallback(() => setIsAIPanelOpen((v) => !v), []);

  const toggleTerminal = useCallback(() => {
    setIsTerminalOpen((prev) => {
      const next = !prev;
      if (next) setHasOpenedTerminal(true);
      return next;
    });
  }, []);

  const onToggleFileSearch = useCallback(() => setIsFileSearchOpen((v) => !v), []);

  // Line comments
  const {
    comments,
    setComments,
    linesWithComments,
    addComment,
    addReply,
    resolveThread,
    deleteThread,
  } = useLineComments();

  const handleAIAction = useCallback(
    ({ action, selectedCode, customPrompt }) => {
      setAiSelectedCode(selectedCode || '');
      setIsAIPanelOpen(true);
      aiSendMessage({
        action,
        selectedCode: selectedCode || '',
        fullCode: editorInstance?.getValue() ?? code,
        language,
        customPrompt: customPrompt || '',
      });
    },
    [aiSendMessage, editorInstance, code, language],
  );

  const replaceSelection = useCallback(
    (newCode) => {
      if (!editorInstance) return;
      const sel = editorInstance.getSelection();
      if (!sel) return;
      editorInstance.executeEdits('ai-replace', [{ range: sel, text: newCode }]);
      editorInstance.focus();
    },
    [editorInstance],
  );

  const insertBelow = useCallback(
    (newCode) => {
      if (!editorInstance) return;
      const pos = editorInstance.getPosition();
      if (!pos) return;
      const line = editorInstance.getModel().getLineCount();
      const insertLine = Math.min(pos.lineNumber + 1, line + 1);
      editorInstance.executeEdits('ai-insert', [
        {
          range: {
            startLineNumber: insertLine,
            startColumn: 1,
            endLineNumber: insertLine,
            endColumn: 1,
          },
          text: '\n' + newCode,
        },
      ]);
      editorInstance.focus();
    },
    [editorInstance],
  );

  // Keep track of the current code in a ref
  useEffect(() => {
    currentCodeRef.current = code;
  }, [code]);

  // Show an alert and reload when kicked or banned
  useEffect(() => {
    const onKicked = () => {
      alert('You were removed from the room by the host.');
      window.location.reload();
    };
    const onBanned = () => {
      alert('You have been banned from this room.');
      window.location.reload();
    };
    window.addEventListener('session:kicked', onKicked);
    window.addEventListener('session:banned', onBanned);
    return () => {
      window.removeEventListener('session:kicked', onKicked);
      window.removeEventListener('session:banned', onBanned);
    };
  }, []);

  // Handle local language changes and propagate
  const handleLocalLanguageChange = useCallback(
    (newLanguage) => {
      setLanguage(newLanguage);
      propagateLanguageChange(newLanguage); // Emit change to others

      // Also update local editor if code hasn't changed from default
      const currentDefaultCode = LANGUAGE_OPTIONS[language]?.defaultCode;
      if (editorInstance && currentCodeRef.current === currentDefaultCode) {
        handleCodeChange(LANGUAGE_OPTIONS[newLanguage].defaultCode);
      }
    },
    [language, editorInstance, handleCodeChange, propagateLanguageChange],
  );

  /**
   * Execute current code
   */
  const executeCode = () => {
    runCode(code, LANGUAGE_OPTIONS[language].id);
  };

  // Sync editor -> file content on change
  const onEditorChange = useCallback(
    (value) => {
      const next = typeof value === 'string' ? value : value ?? '';
      handleCodeChange(next);
      if (selectedFileId) setFileContent(selectedFileId, next);
    },
    [handleCodeChange, selectedFileId, setFileContent],
  );

  // Flag to skip the persistence effect immediately after switching files,
  // preventing stale code from the previous file overwriting the new file's content.
  const fileJustSwitchedRef = useRef(false);

  // When a file is selected, load its content into the editor
  useEffect(() => {
    if (selectedFile && selectedFile.content !== undefined) {
      fileJustSwitchedRef.current = true;
      handleCodeChange(selectedFile.content);
    }
  }, [selectedFileId]);

  // Persist any editor changes (including remote) into the selected file.
  // Skip the first run after a file switch — at that point `code` still holds
  // the previous file's content and would corrupt the newly selected file.
  useEffect(() => {
    if (!selectedFileId) return;
    if (fileJustSwitchedRef.current) {
      fileJustSwitchedRef.current = false;
      return;
    }
    setFileContent(selectedFileId, code);
  }, [code, selectedFileId, setFileContent]);

  // Listen for remote language changes
  useEffect(() => {
    const handleRemoteLanguageUpdate = (event) => {
      const { language: newLanguage } = event.detail;
      console.log('Received remote language change:', newLanguage);

      // Check if the current code is the default for the current language
      const currentDefaultCode = LANGUAGE_OPTIONS[language]?.defaultCode;
      const editorCode = editorInstance?.getValue();

      setLanguage(newLanguage); // Update language state regardless

      // Only update the editor's code if it hasn't been modified by the user
      if (editorInstance && editorCode === currentDefaultCode) {
        console.log('Applying default code for new language:', newLanguage);
        handleCodeChange(LANGUAGE_OPTIONS[newLanguage].defaultCode);
      }
    };

    window.addEventListener('remoteLanguageChange', handleRemoteLanguageUpdate);
    return () =>
      window.removeEventListener(
        'remoteLanguageChange',
        handleRemoteLanguageUpdate,
      );
  }, [language, editorInstance, handleCodeChange]);

  // Effect for Host: Listen for requests to share initial state
  useEffect(() => {
    if (!selfInfo || !editorInstance) return; // Only run if joined and editor ready

    const handleRequestInitialState = (event) => {
      const { requesterId } = event.detail;
      console.log(`Host received request to share state with ${requesterId}`);

      const currentCode = editorInstance.getValue();
      const currentLanguage = language; // Get current language state
      const currentOutput = output; // Get current output state

      shareInitialState({
        requesterId,
        code: currentCode,
        language: currentLanguage,
        output: currentOutput,
        comments,
      });
    };

    window.addEventListener('requestInitialState', handleRequestInitialState);
    return () =>
      window.removeEventListener(
        'requestInitialState',
        handleRequestInitialState,
      );
  }, [selfInfo, editorInstance, language, output, shareInitialState]);

  // Effect for New User: Apply initial state when received
  useEffect(() => {
    const applyInitialState = () => {
      if (initialStateRef.current && editorInstance) {
        const {
          code: initialCode,
          language: initialLanguage,
          output: initialOutput,
        } = initialStateRef.current;

        console.log('Applying initial state:', {
          initialCode: initialCode ? '[code present]' : '[no code]',
          initialLanguage,
          initialOutput: initialOutput ? '[output present]' : '[no output]',
        });

        // Apply code
        if (initialCode !== null && initialCode !== undefined) {
          handleCodeChange(initialCode); // Update local state and editor
        }

        // Apply language
        if (initialLanguage) {
          setLanguage(initialLanguage); // Update local language state
        }

        // Apply output — sync state for collab and write to terminal
        if (initialOutput !== null && initialOutput !== undefined) {
          setOutput(initialOutput);
          onNewOutput(initialOutput);
        }

        // Apply comments from host
        const { comments: initialComments } = initialStateRef.current;
        if (Array.isArray(initialComments) && initialComments.length > 0) {
          setComments(initialComments);
        }

        initialStateRef.current = null;
      }
    };

    // Apply immediately if state is already available (e.g., race condition)
    applyInitialState();

    // Also listen for the event in case state arrives after initial render
    window.addEventListener('initialStateReceived', applyInitialState);
    return () =>
      window.removeEventListener('initialStateReceived', applyInitialState);
  }, [editorInstance, initialStateRef, handleCodeChange, setOutput]); // Add dependencies

  // Render join room form or waiting room if not yet in session
  if (!joinedRoom || !selfInfo) {
    return (
      <ThemeProvider>
        {isWaiting ? (
          <WaitingRoom
            roomId={roomId}
            onCancel={() => {
              // Disconnect from waiting — server will clean up the lobby entry
              window.location.reload();
            }}
          />
        ) : (
          <JoinRoom
            username={username}
            setUsername={setUsername}
            roomId={roomId}
            setRoomId={setRoomId}
            joinRoom={joinRoom}
            connectionError={connectionError}
            usernameError={usernameError}
            isConnected={isConnected}
          />
        )}
      </ThemeProvider>
    );
  }

  // Render main editor view
  return (
    <ThemeProvider>
      <div className="app-container">
        {/* Only render header when not in fullscreen mode */}
        {!isFullScreen && (
          <Header
            language={language}
            setLanguage={handleLocalLanguageChange}
            languageOptions={LANGUAGE_OPTIONS}
            roomId={roomId}
            username={selfInfo.username}
            activeUsers={activeUsers}
            selfInfo={selfInfo}
            onSetPermission={setPermission}
            onKick={kickUser}
            onBan={banUser}
          />
        )}

        <main className={`main-content ${isFullScreen ? 'fullscreen-content' : ''}`}>
          <div className="editor-area">
            <div className="editor-container" style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              {!isFullScreen && (
                <div style={{ width: isFileTreeOpen ? 280 : 0, minWidth: isFileTreeOpen ? 220 : 0, maxWidth: isFileTreeOpen ? 360 : 0, overflow: 'hidden', transition: 'all 0.25s ease' }}>
                  {isFileTreeOpen && (
                    <FileTreePanel
                      tree={tree}
                      selectedId={selectedFileId}
                      onSelect={selectFile}
                      onAddFile={addFile}
                      onAddFolder={addFolder}
                      onRename={renameItem}
                      onDelete={deleteItem}
                    />
                  )}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', gap: 12 }}>
                <RemoteCursors>
                  <CodeEditor
                    language={language}
                    code={code}
                    handleCodeChange={onEditorChange}
                    handleEditorDidMount={handleEditorDidMount}
                    isFullScreen={isFullScreen}
                    toggleFullScreen={toggleFullScreen}
                    toggleTerminal={toggleTerminal}
                    runCode={executeCode}
                    isLoading={isLoading}
                    isFileTreeOpen={isFileTreeOpen}
                    toggleFileTree={toggleFileTree}
                    selectedFile={selectedFile}
                    tree={tree}
                    addFile={addFile}
                    setTree={setTree}
                    isAIPanelOpen={isAIPanelOpen}
                    toggleAIPanel={toggleAIPanel}
                    onAIAction={handleAIAction}
                    onToggleFileSearch={onToggleFileSearch}
                    canEdit={canEdit}
                    comments={comments}
                    linesWithComments={linesWithComments}
                    onAddComment={addComment}
                    onAddReply={addReply}
                    onResolveThread={resolveThread}
                    onDeleteThread={deleteThread}
                    {...mouseMoveProps}
                  />
                </RemoteCursors>
                <AIPanel
                  isOpen={isAIPanelOpen}
                  onClose={() => setIsAIPanelOpen(false)}
                  response={aiResponse}
                  isStreaming={aiIsStreaming}
                  error={aiError}
                  onSendMessage={(args) =>
                    aiSendMessage({
                      ...args,
                      selectedCode: aiSelectedCode,
                      fullCode: editorInstance?.getValue() ?? code,
                      language,
                    })
                  }
                  onStop={aiStop}
                  onClear={aiClearResponse}
                  settings={aiSettings}
                  onUpdateSettings={updateAISettings}
                  selectedCode={aiSelectedCode}
                  language={language}
                  onReplaceSelection={replaceSelection}
                  onInsertBelow={insertBelow}
                />
              </div>
            </div>
          </div>

          <FileSearchModal
            isOpen={isFileSearchOpen}
            onClose={() => setIsFileSearchOpen(false)}
            tree={tree}
            onSelect={selectFile}
          />

          <AdmissionPopup
            requests={joinRequests}
            onAdmit={(userId) => {
              admitUser(userId);
              setJoinRequests((prev) => prev.filter((r) => r.userId !== userId));
            }}
            onDeny={(userId) => {
              denyUser(userId);
              setJoinRequests((prev) => prev.filter((r) => r.userId !== userId));
            }}
          />

          {hasOpenedTerminal && (
            <div className="terminal-section" style={{ display: isTerminalOpen ? 'flex' : 'none' }}>
              <Resizable
                defaultSize={{ width: '100%', height: 240 }}
                minHeight={120}
                maxHeight={600}
                enable={{ top: true, right: false, bottom: false, left: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
                handleClasses={{ top: 'term-resize-handle' }}
              >
                <EmbeddedTerminal ref={terminalCallbackRef} isVisible={isTerminalOpen} onClose={toggleTerminal} />
              </Resizable>
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;