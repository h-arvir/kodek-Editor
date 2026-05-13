import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { motion } from 'framer-motion';
import { VscTerminal, VscClearAll, VscClose, VscAdd, VscDesktopDownload } from 'react-icons/vsc';

import '@xterm/xterm/css/xterm.css';
import '../../styles/Terminal/Terminal.css';

import { useCollaboration } from '../../context/collabration';
import { useTheme } from '../../context/theme';

const DARK_THEME = {
  background:    '#0a0a0a',
  foreground:    '#e8e8e8',
  cursor:        '#9b5de5',
  cursorAccent:  '#0a0a0a',
  selection:     'rgba(155, 93, 229, 0.25)',
  black:         '#1a1a1a',
  red:           '#ef4444',
  green:         '#10b981',
  yellow:        '#f59e0b',
  blue:          '#60a5fa',
  magenta:       '#a855f7',
  cyan:          '#22d3ee',
  white:         '#d4d4d4',
  brightBlack:   '#404040',
  brightRed:     '#f87171',
  brightGreen:   '#34d399',
  brightYellow:  '#fcd34d',
  brightBlue:    '#93c5fd',
  brightMagenta: '#c084fc',
  brightCyan:    '#67e8f9',
  brightWhite:   '#f5f5f5',
};

const LIGHT_THEME = { ...DARK_THEME, background: '#1a1a2e', cursor: '#FB9EC6', selection: 'rgba(251,158,198,0.25)' };

const MONO_THEME = {
  background:    '#000000',
  foreground:    '#ffffff',
  cursor:        '#ffffff',
  cursorAccent:  '#000000',
  selection:     'rgba(255, 255, 255, 0.25)',
  black:         '#000000',
  red:           '#aaaaaa',
  green:         '#cccccc',
  yellow:        '#dddddd',
  blue:          '#888888',
  magenta:       '#bbbbbb',
  cyan:          '#eeeeee',
  white:         '#ffffff',
  brightBlack:   '#444444',
  brightRed:     '#bbbbbb',
  brightGreen:   '#dddddd',
  brightYellow:  '#eeeeee',
  brightBlue:    '#999999',
  brightMagenta: '#cccccc',
  brightCyan:    '#f5f5f5',
  brightWhite:   '#ffffff',
};

const getTermTheme = (theme) => theme === 'mono' ? MONO_THEME : theme === 'light' ? LIGHT_THEME : DARK_THEME;

function useXterm({ containerRef, socket, isDark, isReady, canEdit, theme }) {
  const termRef       = useRef(null);
  const fitRef        = useRef(null);
  const writeQueueRef = useRef([]);
  const canEditRef    = useRef(canEdit);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Keep ref in sync so the onData closure always sees the latest value
  useEffect(() => {
    canEditRef.current = canEdit;
    if (termRef.current) {
      termRef.current.options.disableStdin = !canEdit;
      termRef.current.options.cursorBlink  = canEdit;
    }
  }, [canEdit]);

  useEffect(() => {
    if (!isReady || !containerRef.current || termRef.current) return;

    const term = new Terminal({
      theme:        getTermTheme(theme),
      fontFamily:   "'Fira Code', 'Consolas', 'Courier New', monospace",
      fontSize:     13,
      lineHeight:   1.4,
      cursorBlink:  canEditRef.current,
      cursorStyle:  'block',
      scrollback:   2000,
      convertEol:   true,
      disableStdin: !canEditRef.current,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current  = fit;

    // Flush writes that arrived before xterm was ready
    if (writeQueueRef.current.length > 0) {
      writeQueueRef.current.forEach((t) => term.write(t));
      writeQueueRef.current = [];
    }

    requestAnimationFrame(() => {
      try { fit.fit(); } catch { /* ignore */ }
      const dims = fit.proposeDimensions() || { cols: 80, rows: 24 };
      socket.emit('pty:create', { cols: dims.cols, rows: dims.rows });
      setStatus('running');
    });

    // Guard: only emit input when the user has edit permission
    const inputDisp = term.onData((data) => {
      if (canEditRef.current) socket.emit('pty:input', { data });
    });

    const onData  = ({ data })     => term.write(data);
    const onExit  = ({ exitCode }) => { setStatus('exited'); term.write(`\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\n`); };
    const onError = ({ message })  => { setStatus('error'); setErrorMsg(message); term.write(`\n\x1b[31m[Error: ${message}]\x1b[0m\n`); };

    socket.on('pty:data',  onData);
    socket.on('pty:exit',  onExit);
    socket.on('pty:error', onError);

    const ro = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current) return;
      try {
        fitRef.current.fit();
        const d = fitRef.current.proposeDimensions();
        if (d) socket.emit('pty:resize', { cols: d.cols, rows: d.rows });
      } catch { /* ignore */ }
    });
    ro.observe(containerRef.current);

    return () => {
      inputDisp.dispose();
      socket.off('pty:data',  onData);
      socket.off('pty:exit',  onExit);
      socket.off('pty:error', onError);
      ro.disconnect();
      socket.emit('pty:destroy');
      term.dispose();
      termRef.current = null;
      fitRef.current  = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = getTermTheme(theme);
  }, [theme]);

  const clear = () => termRef.current?.clear();

  const downloadOutput = () => {
    if (!termRef.current) return;
    const buf = termRef.current.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) {
      lines.push(buf.getLine(i)?.translateToString(true) ?? '');
    }
    const content = lines.join('\n').trimEnd();
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'terminal-output.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const restart = () => {
    if (!termRef.current) return;
    writeQueueRef.current = [];
    socket.emit('pty:destroy');
    termRef.current.clear();
    termRef.current.write('\x1b[2J\x1b[H');
    const dims = fitRef.current?.proposeDimensions() || { cols: 80, rows: 24 };
    socket.emit('pty:create', { cols: dims.cols, rows: dims.rows });
    setStatus('running');
    setErrorMsg('');
  };

  // Queue-backed write: safe to call before xterm is initialized
  const write = useCallback((text) => {
    if (termRef.current) {
      termRef.current.write(text);
    } else {
      writeQueueRef.current.push(text);
    }
  }, []);

  return { status, errorMsg, clear, restart, write, downloadOutput };
}

export const EmbeddedTerminal = forwardRef(function EmbeddedTerminal({ isVisible, onClose }, ref) {
  const containerRef = useRef(null);
  const { socket, canEdit } = useCollaboration();
  const { isDark, theme }   = useTheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isVisible && !isReady) setIsReady(true);
  }, [isVisible, isReady]);

  const { status, errorMsg, clear, restart, write, downloadOutput } = useXterm({ containerRef, socket, isDark, isReady, canEdit, theme });

  useImperativeHandle(ref, () => ({ write }), [write]);

  const statusDot = status === 'running' ? 'term-status--running'
    : status === 'exited' ? 'term-status--exited'
    : status === 'error'  ? 'term-status--error'
    : '';

  return (
    <div className="term-panel">
      <div className="term-header">
        <div className="term-header-left">
          <VscTerminal size={14} />
          <span>Terminal</span>
          <span className={`term-status-dot ${statusDot}`} title={errorMsg || status} />
        </div>
        <div className="term-header-right">
          {(status === 'exited' || status === 'error') && (
            <button className="term-icon-btn" onClick={restart} title="New session">
              <VscAdd size={14} />
            </button>
          )}
          <button className="term-icon-btn" onClick={downloadOutput} title="Download output">
            <VscDesktopDownload size={14} />
          </button>
          <button className="term-icon-btn" onClick={clear} title="Clear">
            <VscClearAll size={14} />
          </button>
          <button className="term-icon-btn" onClick={onClose} title="Close terminal">
            <VscClose size={15} />
          </button>
        </div>
      </div>

      {!canEdit && (
        <div className="term-readonly-bar">
          Terminal is view-only — input disabled
        </div>
      )}

      <motion.div
        className="term-body"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
      >
        <div
          ref={containerRef}
          className="term-xterm-container"
          style={{ visibility: isReady ? 'visible' : 'hidden' }}
        />
        {!isReady && (
          <div className="term-placeholder">
            <VscTerminal size={28} />
            <p>Starting terminal…</p>
          </div>
        )}
      </motion.div>
    </div>
  );
});
