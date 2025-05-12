import Editor, { loader } from '@monaco-editor/react';

import '../../styles/Editor/CodeEditor.css';

import { memo, useState, useEffect } from 'react';

import {
  VscTerminalPowershell,
  VscFeedback,
  VscComment,
  } from 'react-icons/vsc';
import { IoMdSunny, IoMdMoon } from 'react-icons/io';
import { BsMic } from 'react-icons/bs';

import Dock from '../../../reactbits/dock';
import { ChatDock } from '../Chat/ChatDock';
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
    ...props
  }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
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
      // Placeholder for audio chat functionality
      alert('Audio chat feature coming soon!');
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
          <button
            className="button-secondary"
            onClick={toggleFullScreen}
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
          </button>
          <button
            className="button"
            onClick={runCode}
            disabled={isLoading}
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
          </button>
        </div>
        <div className="editor-layout">
          <div className="dock-container">
            <Dock
              items={items}
              panelHeight={68}
              baseItemSize={60}
              magnification={70}
            />
            <ChatDock isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
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
