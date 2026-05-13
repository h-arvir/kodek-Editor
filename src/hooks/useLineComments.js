import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCollaboration } from '../context/collabration';

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function useLineComments() {
  const { socket, selfInfo, joinedRoom, roomId } = useCollaboration();
  const [comments, setComments] = useState([]);

  // Map lineNumber → array of comments on that line
  const commentsByLine = useMemo(() => {
    const map = new Map();
    for (const c of comments) {
      if (!map.has(c.lineNumber)) map.set(c.lineNumber, []);
      map.get(c.lineNumber).push(c);
    }
    return map;
  }, [comments]);

  const linesWithComments = useMemo(
    () => new Set(comments.filter((c) => !c.resolved).map((c) => c.lineNumber)),
    [comments],
  );

  // ── Emitters ────────────────────────────────────────────────────────────

  const addComment = useCallback(
    (lineNumber, text) => {
      if (!selfInfo || !joinedRoom || !roomId || !text.trim()) return;
      const comment = {
        id: makeId(),
        lineNumber,
        replies: [
          {
            id: makeId(),
            userId: selfInfo.id,
            username: selfInfo.username,
            color: selfInfo.color,
            text: text.trim(),
            timestamp: new Date().toISOString(),
          },
        ],
        resolved: false,
        authorId: selfInfo.id,
      };
      setComments((prev) => [...prev, comment]);
      socket.emit('lineComment:add', { roomId, comment });
    },
    [selfInfo, joinedRoom, roomId, socket],
  );

  const addReply = useCallback(
    (commentId, text) => {
      if (!selfInfo || !text.trim()) return;
      const reply = {
        id: makeId(),
        userId: selfInfo.id,
        username: selfInfo.username,
        color: selfInfo.color,
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c,
        ),
      );
      socket.emit('lineComment:reply', { roomId, commentId, reply });
    },
    [selfInfo, roomId, socket],
  );

  const resolveThread = useCallback(
    (commentId) => {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)),
      );
      socket.emit('lineComment:resolve', { roomId, commentId });
    },
    [roomId, socket],
  );

  const deleteThread = useCallback(
    (commentId) => {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      socket.emit('lineComment:delete', { roomId, commentId });
    },
    [roomId, socket],
  );

  // ── Receivers ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selfInfo) return;

    const onAdd = ({ comment }) =>
      setComments((prev) => [...prev, comment]);

    const onReply = ({ commentId, reply }) =>
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c,
        ),
      );

    const onResolve = ({ commentId }) =>
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)),
      );

    const onDelete = ({ commentId }) =>
      setComments((prev) => prev.filter((c) => c.id !== commentId));

    socket.on('lineComment:add', onAdd);
    socket.on('lineComment:reply', onReply);
    socket.on('lineComment:resolve', onResolve);
    socket.on('lineComment:delete', onDelete);

    return () => {
      socket.off('lineComment:add', onAdd);
      socket.off('lineComment:reply', onReply);
      socket.off('lineComment:resolve', onResolve);
      socket.off('lineComment:delete', onDelete);
    };
  }, [selfInfo, socket]);

  return {
    comments,
    setComments,
    commentsByLine,
    linesWithComments,
    addComment,
    addReply,
    resolveThread,
    deleteThread,
  };
}
