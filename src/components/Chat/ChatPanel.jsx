import { useEffect, useRef, useState } from 'react';
import { FiSend, FiMessageSquare } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

import { useCollaboration } from '../../context/collabration';

const MESSAGE_MAX_LENGTH = 500;

export function ChatPanel() {
  const {
    chatMessages,
    sendChatMessage,
    unreadCount,
    markChatAsRead,
    selfInfo,
    activeUsers,
  } = useCollaboration();
  
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
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
  
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };
  
  return (
    <div className="chat-container">
      <button 
        className="chat-toggle-btn"
        onClick={toggleChat}
        title={isOpen ? "Close chat" : "Open chat"}
      >
        <FiMessageSquare />
        {!isOpen && unreadCount > 0 && (
          <span className="chat-notification-badge">{unreadCount}</span>
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="chat-panel"
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ duration: 0.3 }}
          >
            <div className="chat-header">
              <h3>Chat</h3>
              <div className="chat-active-users">
                {activeUsers.length} users online
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
                <FiSend />
              </button>
            </form>
            
            <div className="chat-character-count">
              {message.length}/{MESSAGE_MAX_LENGTH}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 