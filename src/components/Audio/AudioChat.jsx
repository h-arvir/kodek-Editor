import { useState, useEffect, useRef, useCallback } from 'react';
import { useCollaboration } from '../../context/collabration';
import { BsMic, BsMicMute } from 'react-icons/bs';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/Audio/AudioChat.css';
import { ICE_SERVERS } from '../../utils/webrtcConfig';

export const AudioChat = ({ isActive, onToggle }) => {
  const { socket, roomId, selfInfo, joinedRoom } = useCollaboration();

  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState(new Set());
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Refs for WebRTC
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // Map of userId -> RTCPeerConnection
  const audioElementsRef = useRef(new Map()); // Map of userId -> audio element
  
  // Request microphone permission
  const requestMicrophonePermission = useCallback(async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      localStreamRef.current = stream;
      setHasPermission(true);
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      let errorMessage = 'Microphone access denied';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microphone is being used by another application.';
      }
      
      setPermissionError(errorMessage);
      setHasPermission(false);
      return null;
    }
  }, []);
  
  // Create peer connection for a specific user
  const createPeerConnection = useCallback((userId) => {
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }
    
    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from:', userId);
      const [remoteStream] = event.streams;
      
      // Create or update audio element for this user
      let audioElement = audioElementsRef.current.get(userId);
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElementsRef.current.set(userId, audioElement);
      }
      audioElement.srcObject = remoteStream;
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          roomId,
          targetUserId: userId,
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setConnectedUsers(prev => new Set([...prev, userId]));
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        setConnectedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    };
    
    peerConnectionsRef.current.set(userId, peerConnection);
    return peerConnection;
  }, [socket, roomId]);
  
  // Create offer for a specific user
  const createOffer = useCallback(async (userId) => {
    try {
      const peerConnection = createPeerConnection(userId);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      if (socket) {
        socket.emit('webrtc-offer', {
          roomId,
          targetUserId: userId,
          offer
        });
      }
    } catch (error) {
      console.error('Error creating offer for', userId, error);
    }
  }, [createPeerConnection, socket, roomId]);
  
  // Handle incoming offer
  const handleOffer = useCallback(async (fromUserId, offer) => {
    try {
      const peerConnection = createPeerConnection(fromUserId);
      await peerConnection.setRemoteDescription(offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      if (socket) {
        socket.emit('webrtc-answer', {
          roomId,
          targetUserId: fromUserId,
          answer
        });
      }
    } catch (error) {
      console.error('Error handling offer from', fromUserId, error);
    }
  }, [createPeerConnection, socket, roomId]);
  
  // Handle incoming answer
  const handleAnswer = useCallback(async (fromUserId, answer) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling answer from', fromUserId, error);
    }
  }, []);
  
  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (fromUserId, candidate) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(fromUserId);
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate from', fromUserId, error);
    }
  }, []);
  
  // Start audio chat
  const startAudioChat = useCallback(async () => {
    if (!socket || !roomId || !selfInfo || !joinedRoom) {
      console.error('Missing socket, roomId, selfInfo, or not joined room', {
        socket: !!socket,
        roomId: !!roomId,
        selfInfo: !!selfInfo,
        joinedRoom
      });
      return;
    }
    
    setIsInitializing(true);
    
    try {
      // Request microphone permission and get stream
      const stream = await requestMicrophonePermission();
      if (!stream) {
        setIsInitializing(false);
        return;
      }
      
      // Notify server that we joined audio chat
      socket.emit('audio-chat-join', { roomId });
      
      setIsConnected(true);
      setIsInitializing(false);
      
      console.log('Audio chat started successfully');
    } catch (error) {
      console.error('Error starting audio chat:', error);
      setIsInitializing(false);
    }
  }, [socket, roomId, selfInfo, joinedRoom, requestMicrophonePermission]);
  
  // Stop audio chat
  const stopAudioChat = useCallback(() => {
    if (!socket || !roomId) return;
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close all peer connections
    peerConnectionsRef.current.forEach((peerConnection) => {
      peerConnection.close();
    });
    peerConnectionsRef.current.clear();
    
    // Stop all audio elements
    audioElementsRef.current.forEach((audioElement) => {
      audioElement.pause();
      audioElement.srcObject = null;
    });
    audioElementsRef.current.clear();
    
    // Notify server that we left audio chat
    socket.emit('audio-chat-leave', { roomId });
    
    setIsConnected(false);
    setConnectedUsers(new Set());
    setHasPermission(false);
    setPermissionError(null);
    
    console.log('Audio chat stopped');
  }, [socket, roomId]);
  
  // Toggle mute/unmute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);
  
  // Handle main toggle (start/stop audio chat)
  const handleToggle = useCallback(() => {
    if (isConnected) {
      stopAudioChat();
      onToggle(); // Only close dialog when leaving audio chat
    } else {
      startAudioChat();
      // Don't call onToggle() when joining - keep dialog open
    }
  }, [isConnected, startAudioChat, stopAudioChat, onToggle]);
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;
    
    const handleWebRTCOffer = ({ fromUserId, offer }) => {
      console.log('Received WebRTC offer from:', fromUserId);
      handleOffer(fromUserId, offer);
    };
    
    const handleWebRTCAnswer = ({ fromUserId, answer }) => {
      console.log('Received WebRTC answer from:', fromUserId);
      handleAnswer(fromUserId, answer);
    };
    
    const handleWebRTCIceCandidate = ({ fromUserId, candidate }) => {
      handleIceCandidate(fromUserId, candidate);
    };
    
    const handleUserJoinedAudio = ({ userId, username }) => {
      console.log(`${username} joined audio chat`);
      // If we're already connected, create an offer for the new user
      if (isConnected && userId !== selfInfo?.id) {
        createOffer(userId);
      }
    };
    
    const handleUserLeftAudio = ({ userId, username }) => {
      console.log(`${username} left audio chat`);
      // Clean up connection for this user
      const peerConnection = peerConnectionsRef.current.get(userId);
      if (peerConnection) {
        peerConnection.close();
        peerConnectionsRef.current.delete(userId);
      }
      
      const audioElement = audioElementsRef.current.get(userId);
      if (audioElement) {
        audioElement.pause();
        audioElement.srcObject = null;
        audioElementsRef.current.delete(userId);
      }
      
      setConnectedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };
    
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('webrtc-ice-candidate', handleWebRTCIceCandidate);
    socket.on('user-joined-audio', handleUserJoinedAudio);
    socket.on('user-left-audio', handleUserLeftAudio);
    
    return () => {
      socket.off('webrtc-offer', handleWebRTCOffer);
      socket.off('webrtc-answer', handleWebRTCAnswer);
      socket.off('webrtc-ice-candidate', handleWebRTCIceCandidate);
      socket.off('user-joined-audio', handleUserJoinedAudio);
      socket.off('user-left-audio', handleUserLeftAudio);
    };
  }, [socket, isConnected, selfInfo, handleOffer, handleAnswer, handleIceCandidate, createOffer]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        stopAudioChat();
      }
    };
  }, [isConnected, stopAudioChat]);
  
  // Don't render anything if not active
  if (!isActive) return null;
  
  // Don't render if not in a room
  if (!joinedRoom || !roomId || !selfInfo) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="audio-chat-panel"
        >
          <h3>Audio Chat</h3>
          <div className="audio-chat-error">
            Please join a collaboration room first to use audio chat.
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="audio-chat-panel"
      >
        <h3>Audio Chat</h3>
        
        {permissionError && (
          <div className="audio-chat-error">
            {permissionError}
          </div>
        )}
        
        <div className="audio-chat-controls">
          <button
            onClick={handleToggle}
            disabled={isInitializing}
            className={`audio-chat-button ${isConnected ? 'leave' : 'join'}`}
          >
            {isInitializing ? (
              <>
                <div className="audio-chat-spinner" />
                Connecting...
              </>
            ) : isConnected ? (
              <>
                <BsMic size={16} />
                Leave Audio
              </>
            ) : (
              <>
                <BsMic size={16} />
                Join Audio
              </>
            )}
          </button>
          
          {isConnected && (
            <span
              onClick={toggleMute}
              className="audio-chat-mute-icon"
              role="button"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={isMuted ? 'Unmute' : 'Mute'}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleMute(); }}
            >
              {isMuted ? <BsMicMute size={20} /> : <BsMic size={20} />}
            </span>
          )}
        </div>
        
        {isConnected && (
          <div className="audio-chat-status">
            {connectedUsers.size === 0 ? (
              'Waiting for others to join...'
            ) : (
              <>
                <span className="audio-chat-connected-indicator"></span>
                Connected to {connectedUsers.size} user{connectedUsers.size === 1 ? '' : 's'}
              </>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};