import { useEffect, useRef, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

import { useCollaboration } from '../../context/collabration';
import { formatTime } from '../../utils/time';

const MESSAGE_MAX_LENGTH = 500;

export function ChatDock({ isOpen, setIsOpen }) {
  const {
    chatMessages,
    sendChatMessage,
    unreadCount,
    markChatAsRead,
    selfInfo,
    activeUsers,
  } = useCollaboration();

  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);
  
  // Mark messages as read when panel is opened
  useEffect(() => {
    if (isOpen) {
      markChatAsRead();
    }
  }, [isOpen, markChatAsRead]);
  
  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && message.length <= MESSAGE_MAX_LENGTH) {
      sendChatMessage(message.trim());
      setMessage('');
    }
  };
  
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
              <div className="chat-active-users">
                {activeUsers.length} users online
              </div>
              <button 
                className="chat-close-btn" 
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
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
                    <span 
                      className="message-username" 
                      style={{ color: msg.color }}
                    >
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
          
          <form onSubmit={handleSendMessage} className="chat-input-container">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              maxLength={MESSAGE_MAX_LENGTH}
              className="chat-input"
            />
            <button 
              type="submit" 
              className="chat-send-btn"
              disabled={!message.trim() || message.length > MESSAGE_MAX_LENGTH}
            >
              <FiSend />🚀
            </button>
          </form>
          
          <div className="chat-character-count">
            {message.length}/{MESSAGE_MAX_LENGTH}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 