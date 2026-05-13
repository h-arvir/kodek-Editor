import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { VscTerminal, VscClearAll, VscClose, VscDesktopDownload } from 'react-icons/vsc';

import '../../styles/Terminal/Terminal.css';

// Strip ANSI escape codes (for plain-text download)
const stripAnsi = (str) => str.replace(/\x1b\[\d+m/g, '');

const ANSI_COLOR_MAP = {
  31: 'var(--out-red)',
  32: 'var(--out-green)',
  33: 'var(--out-yellow)',
  36: 'var(--out-cyan)',
};

// Parses a string containing ANSI color/dim codes into an array of styled segments
function parseAnsi(text) {
  const segments = [];
  const regex = /\x1b\[(\d+)m/g;
  let lastIndex = 0;
  let style = {};
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), style: { ...style } });
    }
    const code = parseInt(match[1], 10);
    if (code === 0) style = {};
    else if (code === 2) style = { opacity: 0.5 };
    else if (ANSI_COLOR_MAP[code]) style = { color: ANSI_COLOR_MAP[code] };
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), style: { ...style } });
  }
  return segments;
}

function AnsiText({ text }) {
  const segments = parseAnsi(text);
  return (
    <>
      {segments.map((seg, i) =>
        Object.keys(seg.style).length > 0
          ? <span key={i} style={seg.style}>{seg.text}</span>
          : <span key={i}>{seg.text}</span>
      )}
    </>
  );
}

export const EmbeddedTerminal = forwardRef(function EmbeddedTerminal({ isVisible, onClose }, ref) {
  const rawRef  = useRef('');       // accumulates plain text for download
  const bodyRef = useRef(null);     // scroll container
  const [chunks, setChunks] = useState([]);

  // Auto-scroll to bottom whenever new output arrives
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [chunks]);

  const write = useCallback((text) => {
    rawRef.current += text;
    setChunks((prev) => [...prev, text]);
  }, []);

  const clear = useCallback(() => {
    rawRef.current = '';
    setChunks([]);
  }, []);

  useImperativeHandle(ref, () => ({ write, clear }), [write, clear]);

  const downloadOutput = () => {
    const content = stripAnsi(rawRef.current).trim();
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'output.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  // Join all chunks into one string and render with ANSI → styled spans
  const allText = chunks.join('');

  return (
    <div className="term-panel">
      <div className="term-header">
        <div className="term-header-left">
          <VscTerminal size={14} />
          <span>Output</span>
        </div>
        <div className="term-header-right">
          <button className="term-icon-btn" onClick={downloadOutput} title="Download output">
            <VscDesktopDownload size={14} />
          </button>
          <button className="term-icon-btn" onClick={clear} title="Clear">
            <VscClearAll size={14} />
          </button>
          <button className="term-icon-btn" onClick={onClose} title="Close">
            <VscClose size={15} />
          </button>
        </div>
      </div>

      <motion.div
        ref={bodyRef}
        className="term-body output-body"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
      >
        {chunks.length === 0 ? (
          <div className="term-placeholder">
            <VscTerminal size={28} />
            <p>Run your code to see output here</p>
          </div>
        ) : (
          <pre className="output-pre">
            <AnsiText text={allText} />
          </pre>
        )}
      </motion.div>
    </div>
  );
});
