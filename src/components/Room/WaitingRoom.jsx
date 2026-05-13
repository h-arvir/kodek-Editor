import '../../styles/Room/WaitingRoom.css';

export function WaitingRoom({ roomId, onCancel }) {
  return (
    <div className="waiting-overlay">
      <div className="waiting-card">
        <div className="waiting-logo">Kodek</div>

        <div className="waiting-spinner" />

        <p className="waiting-title">Waiting for the host to let you in…</p>
        <p className="waiting-sub">
          The host will admit or deny your request shortly.
        </p>

        <div className="waiting-room-badge">
          Room: <strong>{roomId}</strong>
        </div>

        <button className="waiting-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
