import { useEffect, useRef, useState } from 'react';
import { FiSend, FiSmile } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

import { useCollaboration } from '../../context/collabration';
import { formatTime } from '../../utils/time';

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
    unreadCount,
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
          className="chat-panel dock-chat-panel"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <div className="chat-header">
            <h3>Chat</h3>
            <div className="chat-controls">
              <div className="chat-active-users">{activeUsers.length} online</div>
              <button className="chat-close-btn" onClick={() => setIsOpen(false)} aria-label="Close chat">
                &times;
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet. Start a conversation!</p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`chat-message ${msg.userId === selfInfo?.id ? 'own-message' : 'other-message'}`}
                >
                  <div className="message-header">
                    <span className="message-username" style={{ color: msg.color }}>
                      {msg.userId === selfInfo?.id ? 'You' : msg.username}
                    </span>
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="message-content">{msg.text}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="typing-indicator-row">
            {typingList.length > 0 && (
              <span className="typing-indicator">
                <span className="typing-dots"><span /><span /><span /></span>
                {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing…
              </span>
            )}
          </div>

          <form onSubmit={handleSend} className="chat-input-container">
            <div ref={emojiRef} style={{ position: 'relative' }}>
              <button type="button" className="chat-send-btn" onClick={() => setEmojiOpen((v) => !v)} title="Emoji">
                <FiSmile />
              </button>
              {emojiOpen && (
                <div className="emoji-picker">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" className="emoji-btn" onClick={() => insertEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={handleInputChange}
              placeholder="Type a message..."
              maxLength={MESSAGE_MAX_LENGTH}
              className="chat-input"
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={!message.trim() || message.length > MESSAGE_MAX_LENGTH}
            >
              <FiSend />
            </button>
          </form>

          <div className="chat-character-count">{message.length}/{MESSAGE_MAX_LENGTH}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
