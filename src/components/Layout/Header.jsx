import { useRef, useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { MdOutlineEditOff, MdOutlineEdit } from 'react-icons/md';
import { TbUserX, TbUserOff, TbCrown } from 'react-icons/tb';

import '../../styles/Layout/Header.css';
import StaggeredDropDown from '../../../reactbits/StaggeredDropDown';

function HostControls({ user, onSetPermission, onKick, onBan, onClose }) {
  return (
    <div
      className="host-controls-popover"
      onMouseLeave={onClose}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="host-controls-header">
        <span className="host-controls-name">{user.username}</span>
        <button className="host-controls-close" onClick={onClose}><VscClose size={13} /></button>
      </div>
      <div className="host-controls-actions">
        <button
          className="host-ctrl-btn"
          onClick={() => { onSetPermission(user.id, !user.canEdit); onClose(); }}
        >
          {user.canEdit
            ? <><MdOutlineEditOff size={14} /> Set Read-Only</>
            : <><MdOutlineEdit size={14} /> Allow Editing</>}
        </button>
        <button
          className="host-ctrl-btn host-ctrl-btn--warn"
          onClick={() => { onKick(user.id); onClose(); }}
        >
          <TbUserX size={14} /> Kick
        </button>
        <button
          className="host-ctrl-btn host-ctrl-btn--danger"
          onClick={() => { onBan(user.id); onClose(); }}
        >
          <TbUserOff size={14} /> Ban
        </button>
      </div>
    </div>
  );
}

export const Header = ({
  language,
  setLanguage,
  languageOptions,
  roomId,
  username,
  activeUsers,
  selfInfo,
  onSetPermission,
  onKick,
  onBan,
}) => {
  const [openUserId, setOpenUserId] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const isHost = selfInfo?.host === true;
  const currentUser = activeUsers.find((u) => u.username === username);
  const currentUserColor = currentUser?.color ?? '#0078d4';

  const handleAvatarMouseEnter = (id) => {
    clearTimeout(hoverTimeoutRef.current);
    setOpenUserId(id);
  };

  const handleAvatarMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setOpenUserId(null), 120);
  };

  const handlePopoverMouseEnter = () => {
    clearTimeout(hoverTimeoutRef.current);
  };

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="logo">Kodek</h1>
        <div className="room-info">
          <div className="room-badge">
            <span className="room-label">Room</span>
            <span className="room-id">{roomId}</span>
          </div>
          <div className="users-badge">
            <span className="users-label">In Room</span>
            <div className="avatar-stack">
              {activeUsers.map((user) => {
                const isSelf = user.username === username;
                const canInteract = isHost && !isSelf;
                const isReadOnly = !user.canEdit && !user.host;
                const color = user.color || '#10b981';
                return (
                  <div key={user.id} className="user-avatar-wrap">
                    <div
                      className={`user-avatar${canInteract ? ' user-avatar--host-ctrl' : ''}`}
                      style={{
                        background: 'transparent',
                        border: `2px solid ${color}`,
                        color,
                      }}
                      title={
                        canInteract
                          ? `${user.username}${isReadOnly ? ' · Read-Only' : ''} — hover to manage`
                          : `${user.username}${user.host ? ' (Host)' : ''}${isReadOnly ? ' · Read-Only' : ''}`
                      }
                      onMouseEnter={() => canInteract && handleAvatarMouseEnter(user.id)}
                      onMouseLeave={() => canInteract && handleAvatarMouseLeave()}
                    >
                      {user.host && (
                        <span className="avatar-crown" style={{ color }}>
                          <TbCrown size={10} />
                        </span>
                      )}
                      {user.username[0]?.toUpperCase()}
                      {isReadOnly && <span className="avatar-readonly-dot" />}
                    </div>

                    {canInteract && openUserId === user.id && (
                      <div onMouseEnter={handlePopoverMouseEnter}>
                        <HostControls
                          user={user}
                          onSetPermission={onSetPermission}
                          onKick={onKick}
                          onBan={onBan}
                          onClose={() => setOpenUserId(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="current-user-badge">
            <span className="current-user-label">
              You{isHost ? ' · Host' : ''}
            </span>
            <div className="current-user-name-row">
              <span className="current-user-name" style={{ color: currentUserColor }}>
                {username}
              </span>
              {selfInfo && !selfInfo.canEdit && !selfInfo.host && (
                <span className="current-user-readonly-pill">Read-Only</span>
              )}
            </div>
          </div>
        </div>
        <StaggeredDropDown
          language={language}
          setLanguage={setLanguage}
          languageOptions={languageOptions}
        />
      </div>
    </header>
  );
};
