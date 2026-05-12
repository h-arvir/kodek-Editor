import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsChat, BsCheckCircle, BsTrash, BsX, BsSend } from 'react-icons/bs';
import { useCollaboration } from '../../context/collabration';

import '../../styles/Comments/CommentThread.css';

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function UserDot({ color, size = 22 }) {
  return (
    <span
      className="comment-user-dot"
      style={{ background: color, width: size, height: size }}
    />
  );
}

function Reply({ reply }) {
  return (
    <div className="comment-reply">
      <UserDot color={reply.color} size={18} />
      <div className="comment-reply-body">
        <div className="comment-meta">
          <span className="comment-username" style={{ color: reply.color }}>
            {reply.username}
          </span>
          <span className="comment-time">{formatTime(reply.timestamp)}</span>
        </div>
        <p className="comment-text">{reply.text}</p>
      </div>
    </div>
  );
}

function Thread({ comment, selfInfo, onResolve, onDelete, onReply }) {
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const inputRef = useRef(null);
  const canDelete = selfInfo?.id === comment.authorId;

  useEffect(() => {
    if (showReply && inputRef.current) inputRef.current.focus();
  }, [showReply]);

  const submit = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText);
    setReplyText('');
    setShowReply(false);
  };

  return (
    <div className={`comment-thread ${comment.resolved ? 'comment-thread--resolved' : ''}`}>
      {/* Thread header (first reply = original comment) */}
      <div className="comment-thread-header">
        <UserDot color={comment.replies[0]?.color} />
        <div className="comment-thread-header-body">
          <div className="comment-meta">
            <span
              className="comment-username"
              style={{ color: comment.replies[0]?.color }}
            >
              {comment.replies[0]?.username}
            </span>
            <span className="comment-time">
              {comment.resolved ? '✓ Resolved · ' : ''}
              {formatTime(comment.replies[0]?.timestamp)}
            </span>
          </div>
          <p className="comment-text">{comment.replies[0]?.text}</p>
        </div>
        <div className="comment-thread-actions">
          {!comment.resolved && (
            <button
              className="comment-action-btn"
              onClick={() => onResolve(comment.id)}
              title="Mark as resolved"
            >
              <BsCheckCircle size={13} />
            </button>
          )}
          {canDelete && (
            <button
              className="comment-action-btn comment-action-btn--danger"
              onClick={() => onDelete(comment.id)}
              title="Delete thread"
            >
              <BsTrash size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Additional replies */}
      {comment.replies.slice(1).map((r) => (
        <Reply key={r.id} reply={r} />
      ))}

      {/* Reply input */}
      {!comment.resolved && (
        <div className="comment-reply-section">
          {showReply ? (
            <div className="comment-reply-input-row">
              <UserDot color={selfInfo?.color} size={18} />
              <input
                ref={inputRef}
                className="comment-input"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                  if (e.key === 'Escape') {
                    setShowReply(false);
                    setReplyText('');
                  }
                }}
                placeholder="Reply…"
              />
              <button
                className="comment-send-btn"
                onClick={submit}
                disabled={!replyText.trim()}
              >
                <BsSend size={12} />
              </button>
            </div>
          ) : (
            <button
              className="comment-reply-toggle"
              onClick={() => setShowReply(true)}
            >
              Reply
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CommentThread({
  lineNumber,
  position,
  commentsOnLine,
  onAddComment,
  onAddReply,
  onResolveThread,
  onDeleteThread,
  onClose,
}) {
  const { selfInfo } = useCollaboration();
  const [newText, setNewText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [lineNumber]);

  const submitNew = () => {
    if (!newText.trim()) return;
    onAddComment(lineNumber, newText);
    setNewText('');
  };

  if (!position) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="comment-thread-panel"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width: position.width,
          zIndex: 500,
        }}
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        // Prevent Monaco losing selection when clicking the panel
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="comment-panel-header">
          <div className="comment-panel-title">
            <BsChat size={13} />
            <span>Line {lineNumber}</span>
            {commentsOnLine.length > 0 && (
              <span className="comment-count-badge">{commentsOnLine.length}</span>
            )}
          </div>
          <button className="comment-close-btn" onClick={onClose}>
            <BsX size={16} />
          </button>
        </div>

        {/* Existing threads */}
        <div className="comment-threads-list">
          {commentsOnLine.map((comment) => (
            <Thread
              key={comment.id}
              comment={comment}
              selfInfo={selfInfo}
              onResolve={onResolveThread}
              onDelete={onDeleteThread}
              onReply={onAddReply}
            />
          ))}
        </div>

        {/* New comment input */}
        <div className="comment-new-section">
          <UserDot color={selfInfo?.color} size={20} />
          <div className="comment-new-input-wrap">
            <textarea
              ref={inputRef}
              className="comment-textarea"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitNew();
                }
              }}
              placeholder={
                commentsOnLine.length > 0
                  ? 'Add a comment…'
                  : 'Start a review comment on this line…'
              }
              rows={2}
            />
            <div className="comment-new-footer">
              <span className="comment-hint">Enter to submit · Shift+Enter for newline</span>
              <button
                className="comment-submit-btn"
                onClick={submitNew}
                disabled={!newText.trim()}
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
