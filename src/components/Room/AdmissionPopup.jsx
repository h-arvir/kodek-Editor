import { AnimatePresence, motion } from 'framer-motion';
import '../../styles/Room/AdmissionPopup.css';

export function AdmissionPopup({ requests, onAdmit, onDeny }) {
  if (!requests || requests.length === 0) return null;

  return (
    <div className="admission-stack">
      <AnimatePresence>
        {requests.map(({ userId, username, color }) => (
          <motion.div
            key={userId}
            className="admission-card"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.22 }}
          >
            <div
              className="admission-avatar"
              style={{ background: color || '#9b5de5' }}
            >
              {username[0]?.toUpperCase()}
            </div>
            <div className="admission-info">
              <div className="admission-name">{username}</div>
              <div className="admission-label">wants to join</div>
            </div>
            <div className="admission-actions">
              <button className="admission-btn-admit" onClick={() => onAdmit(userId)}>
                Admit
              </button>
              <button className="admission-btn-deny" onClick={() => onDeny(userId)}>
                Deny
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
