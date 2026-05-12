import { useEffect, useRef, useState } from 'react';
import { FiSend, FiSmile } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

import { useCollaboration } from '../../context/collabration';
import { formatTime } from '../../utils/time';
import '../../styles/Chat/ChatDock.css';

const MESSAGE_MAX_LENGTH = 500;

const EMOJIS = [
  '😀','😂','😍','🥰','😎','🤔','😅','😭','🤣','❤️',
  '🔥','👍','👎','💯','🎉','🙌','👋','😒','💪','✨',
  '🚀','💻','☕','🎮','📝','🌟','👀','😆','🤩','🫡',
];

export function ChatDock({ isOpen, setIsOpen }) {
  const {
    chatMessages,
    sendChatMessage,
    markChatAsRead,
    selfInfo,
    activeUsers,
    typingUsers,
    sendTyping,
  } = useCollaboration();

  const [message, setMessage] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  useEffect(() => {
    if (isOpen) markChatAsRead();
  }, [isOpen, markChatAsRead]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setEmojiOpen(false);
    };
    if (emojiOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [emojiOpen]);

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim() && message.length <= MESSAGE_MAX_LENGTH) {
      sendChatMessage(message.trim());
      setMessage('');
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    sendTyping();
  };

  const insertEmoji = (emoji) => {
    setMessage((prev) => prev + emoji);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const typingList = Object.values(typingUsers ?? {});

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="cd-panel"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="cd-header">
            <span className="cd-title">chat</span>
            <div className="cd-header-right">
              <span className="cd-online">
                <span className="cd-online-dot" />
                {activeUsers.length}
              </span>
              <button className="cd-close" onClick={() => setIsOpen(false)} aria-label="Close chat">
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="cd-messages">
            {chatMessages.length === 0 ? (
              <div className="cd-empty">no messages yet</div>
            ) : (
              chatMessages.map((msg, idx) => {
                const isSelf = msg.userId === selfInfo?.id;
                const color = msg.color;
                return (
                  <div key={idx} className={`cd-msg${isSelf ? ' cd-msg--self' : ''}`}>
                    <div className="cd-msg-meta">
                      <span
                        className="cd-avatar"
                        style={{ borderColor: color, color }}
                      >
                        {msg.username[0]?.toUpperCase()}
                      </span>
                      <span className="cd-name" style={{ color }}>
                        {isSelf ? 'you' : msg.username}
                      </span>
                      <span className="cd-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="cd-text">{msg.text}</div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing indicator */}
          {typingList.length > 0 && (
            <div className="cd-typing">
              <span className="cd-dots"><span /><span /><span /></span>
              <span>{typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing</span>
            </div>
          )}

          {/* Input */}
          <form className="cd-form" onSubmit={handleSend}>
            <div ref={emojiRef} className="cd-emoji-wrap">
              <button
                type="button"
                className="cd-icon-btn"
                onClick={() => setEmojiOpen((v) => !v)}
                aria-label="Emoji"
              >
                <FiSmile size={17} />
              </button>
              {emojiOpen && (
                <div className="cd-emoji-picker">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => insertEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              className="cd-input"
              type="text"
              value={message}
              onChange={handleInputChange}
              placeholder="message..."
              maxLength={MESSAGE_MAX_LENGTH}
            />

            <button
              type="submit"
              className="cd-icon-btn cd-send-btn"
              disabled={!message.trim() || message.length > MESSAGE_MAX_LENGTH}
              aria-label="Send"
            >
              <FiSend size={16} />
            </button>
          </form>

          {message.length > 0 && (
            <div className="cd-count">{message.length}/{MESSAGE_MAX_LENGTH}</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
