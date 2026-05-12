import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsStars, BsGear, BsX, BsClipboard, BsArrowReturnLeft, BsArrowDown, BsStop } from 'react-icons/bs';

import '../../styles/AI/AIPanel.css';

const PROVIDERS = [
  { value: 'groq', label: 'Groq (free)' },
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
];

const MODELS = {
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'LLaMA 3.3 70B' },
    { value: 'llama3-70b-8192', label: 'LLaMA3 70B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  ],
  claude: [
    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fast)' },
    { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
  ],
};

function parseResponse(text) {
  const parts = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', content: text.slice(last, match.index) });
    }
    parts.push({ type: 'code', lang: match[1] || 'code', content: match[2].trimEnd() });
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push({ type: 'text', content: text.slice(last) });
  }

  return parts;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button className="ai-code-action-btn" onClick={handleCopy} title="Copy code">
      <BsClipboard size={12} />
      <span>{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  );
}

export function AIPanel({
  isOpen,
  onClose,
  response,
  isStreaming,
  error,
  onSendMessage,
  onStop,
  onClear,
  settings,
  onUpdateSettings,
  selectedCode,
  language,
  onReplaceSelection,
  onInsertBelow,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showKey, setShowKey] = useState(false);
  const responseRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll response area as tokens arrive
  useEffect(() => {
    if (isStreaming && responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response, isStreaming]);

  const handleSend = () => {
    if (!customPrompt.trim() && !selectedCode) return;
    onSendMessage({ action: 'custom', customPrompt, selectedCode, fullCode: '', language });
    setCustomPrompt('');
  };

  const handleQuickAction = (action) => {
    onSendMessage({ action, selectedCode, fullCode: '', language });
  };

  const segments = parseResponse(response);
  const currentKey =
    settings.provider === 'groq'
      ? settings.groqKey
      : settings.provider === 'claude'
        ? settings.claudeKey
        : settings.openaiKey;

  const keyField =
    settings.provider === 'groq'
      ? 'groqKey'
      : settings.provider === 'claude'
        ? 'claudeKey'
        : 'openaiKey';

  const modelField =
    settings.provider === 'groq'
      ? 'groqModel'
      : settings.provider === 'claude'
        ? 'claudeModel'
        : 'openaiModel';

  const currentModel =
    settings.provider === 'groq'
      ? settings.groqModel
      : settings.provider === 'claude'
        ? settings.claudeModel
        : settings.openaiModel;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ai-panel"
          initial={{ opacity: 0, x: 24, width: 0 }}
          animate={{ opacity: 1, x: 0, width: 340 }}
          exit={{ opacity: 0, x: 24, width: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="ai-panel-header">
            <div className="ai-panel-title">
              <BsStars size={14} className="ai-stars-icon" />
              <span>AI Assistant</span>
            </div>
            <div className="ai-panel-actions">
              {response && !isStreaming && (
                <button className="ai-icon-btn" onClick={onClear} title="Clear">
                  <BsX size={16} />
                </button>
              )}
              <button
                className={`ai-icon-btn ${showSettings ? 'ai-icon-btn--active' : ''}`}
                onClick={() => setShowSettings((v) => !v)}
                title="Settings"
              >
                <BsGear size={14} />
              </button>
              <button className="ai-icon-btn" onClick={onClose} title="Close">
                <BsX size={18} />
              </button>
            </div>
          </div>

          {/* Settings drawer */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                className="ai-settings"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="ai-settings-inner">
                  <div className="ai-field">
                    <label className="ai-label">Provider</label>
                    <select
                      className="ai-select"
                      value={settings.provider}
                      onChange={(e) => onUpdateSettings({ provider: e.target.value })}
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ai-field">
                    <label className="ai-label">Model</label>
                    <select
                      className="ai-select"
                      value={currentModel}
                      onChange={(e) => onUpdateSettings({ [modelField]: e.target.value })}
                    >
                      {MODELS[settings.provider].map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ai-field">
                    <label className="ai-label">API Key</label>
                    <div className="ai-key-row">
                      <input
                        className="ai-input-field"
                        type={showKey ? 'text' : 'password'}
                        value={currentKey}
                        onChange={(e) => onUpdateSettings({ [keyField]: e.target.value })}
                        placeholder="Paste your API key…"
                        autoComplete="off"
                      />
                      <button
                        className="ai-icon-btn"
                        onClick={() => setShowKey((v) => !v)}
                        title={showKey ? 'Hide key' : 'Show key'}
                      >
                        {showKey ? '🙈' : '👁'}
                      </button>
                    </div>
                    <p className="ai-hint">
                      {settings.provider === 'groq' && (
                        <>Get a free key at console.groq.com</>
                      )}
                      {settings.provider === 'claude' && <>Anthropic key — console.anthropic.com</>}
                      {settings.provider === 'openai' && <>OpenAI key — platform.openai.com</>}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected code preview */}
          {selectedCode && (
            <div className="ai-context-banner">
              <span className="ai-context-label">Context:</span>
              <span className="ai-context-preview">
                {selectedCode.slice(0, 60).replace(/\n/g, ' ')}
                {selectedCode.length > 60 ? '…' : ''}
              </span>
            </div>
          )}

          {/* Quick actions (only when there's selected code and not streaming) */}
          {selectedCode && !isStreaming && (
            <div className="ai-quick-actions">
              <button className="ai-quick-btn" onClick={() => handleQuickAction('explain')}>
                Explain
              </button>
              <button className="ai-quick-btn" onClick={() => handleQuickAction('refactor')}>
                Refactor
              </button>
              <button className="ai-quick-btn" onClick={() => handleQuickAction('fix')}>
                Fix Bugs
              </button>
            </div>
          )}

          {/* Response area */}
          <div className="ai-response-area" ref={responseRef}>
            {!response && !error && !isStreaming && (
              <div className="ai-empty-state">
                <BsStars size={28} className="ai-empty-icon" />
                <p>Select code in the editor and pick an action, or type a question below.</p>
              </div>
            )}

            {error && (
              <div className="ai-error-box">
                <span>{error}</span>
              </div>
            )}

            {segments.map((seg, i) =>
              seg.type === 'text' ? (
                <p key={i} className="ai-text-segment">
                  {seg.content}
                </p>
              ) : (
                <div key={i} className="ai-code-block">
                  <div className="ai-code-block-header">
                    <span className="ai-code-lang">{seg.lang}</span>
                    <div className="ai-code-block-actions">
                      <CopyButton text={seg.content} />
                      {onReplaceSelection && (
                        <button
                          className="ai-code-action-btn"
                          onClick={() => onReplaceSelection(seg.content)}
                          title="Replace selected code"
                        >
                          <BsArrowReturnLeft size={12} />
                          <span>Replace</span>
                        </button>
                      )}
                      {onInsertBelow && (
                        <button
                          className="ai-code-action-btn"
                          onClick={() => onInsertBelow(seg.content)}
                          title="Insert below cursor"
                        >
                          <BsArrowDown size={12} />
                          <span>Insert</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className="ai-code-pre">
                    <code>{seg.content}</code>
                  </pre>
                </div>
              ),
            )}

            {isStreaming && <span className="ai-stream-cursor">▋</span>}
          </div>

          {/* Input area */}
          <div className="ai-input-area">
            <textarea
              ref={textareaRef}
              className="ai-textarea"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming) handleSend();
                }
              }}
              placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
              rows={2}
              disabled={isStreaming}
            />
            <div className="ai-input-footer">
              {isStreaming ? (
                <button className="ai-stop-btn" onClick={onStop}>
                  <BsStop size={13} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  className="button ai-send-btn"
                  onClick={handleSend}
                  disabled={!customPrompt.trim() && !selectedCode}
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
