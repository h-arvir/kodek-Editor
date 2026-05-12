import '../../styles/Layout/Header.css';

import StaggeredDropDown from '../../../reactbits/StaggeredDropDown'; // adjust the path accordingly

export const Header = ({
  language,
  setLanguage,
  languageOptions,
  roomId,
  username, // Current user's username
  activeUsers, // Array of { id, username, color }
  // userColors prop removed
}) => {
  // Find the current user's object to get their color
  const currentUser = activeUsers.find((user) => user.username === username);
  const currentUserColor = currentUser ? currentUser.color : '#0078d4'; // Default color if not found

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
              {activeUsers.map((user) => (
                <div
                  key={user.id}
                  className="user-avatar"
                  style={{ background: user.color || '#10b981' }}
                  title={`${user.username}${user.host ? ' (Host)' : ''}`}
                >
                  {user.username[0]?.toUpperCase()}
                </div>
              ))}
            </div>
          </div>
          <div className="current-user-badge">
            <span className="current-user-label">You</span>
            <span
              className="current-user-name"
              style={{ color: currentUserColor }} // Use the found color
            >
              {username}
            </span>
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
