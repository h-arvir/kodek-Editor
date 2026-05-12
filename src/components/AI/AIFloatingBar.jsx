import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsStars } from 'react-icons/bs';

export function AIFloatingBar({ position, onAction, visible }) {
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (showCustom && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustom]);

  // Reset state when bar hides
  useEffect(() => {
    if (!visible) {
      setShowCustom(false);
      setCustomInput('');
    }
  }, [visible]);

  if (!visible || !position) return null;

  const handleAction = (action) => {
    if (action === 'custom') {
      if (!showCustom) {
        setShowCustom(true);
        return;
      }
      if (!customInput.trim()) return;
      onAction({ action: 'custom', customPrompt: customInput });
      setCustomInput('');
      setShowCustom(false);
      return;
    }
    onAction({ action });
  };

  return (
    <AnimatePresence>
      <motion.div
        className="ai-floating-bar"
        style={{
          top: Math.max(4, position.top - 44),
          left: Math.max(4, position.left),
        }}
        initial={{ opacity: 0, y: 6, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.95 }}
        transition={{ duration: 0.13, ease: 'easeOut' }}
        // Prevent Monaco from losing selection when clicking the bar
        onMouseDown={(e) => e.preventDefault()}
      >
        <BsStars size={12} className="ai-floating-star" />
        <button
          className="ai-float-btn"
          onClick={() => handleAction('explain')}
        >
          Explain
        </button>
        <button
          className="ai-float-btn"
          onClick={() => handleAction('refactor')}
        >
          Refactor
        </button>
        <button
          className="ai-float-btn"
          onClick={() => handleAction('fix')}
        >
          Fix Bugs
        </button>
        <div className="ai-float-divider" />
        {showCustom ? (
          <input
            ref={inputRef}
            className="ai-float-input"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customInput.trim()) handleAction('custom');
              if (e.key === 'Escape') {
                setShowCustom(false);
                setCustomInput('');
              }
              e.stopPropagation();
            }}
            placeholder="Ask anything…"
          />
        ) : (
          <button
            className="ai-float-btn ai-float-btn--dim"
            onClick={() => handleAction('custom')}
          >
            Ask…
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
