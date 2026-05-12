import { useState, useEffect, useRef, useCallback } from 'react';
import { useCollaboration } from '../../context/collabration';
import { BsCameraVideo, BsCameraVideoOff, BsMic, BsMicMute } from 'react-icons/bs';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/Audio/VideoChat.css';
import { ICE_SERVERS } from '../../utils/webrtcConfig';

export const VideoChat = ({ isActive, onToggle }) => {
  const { socket, roomId, selfInfo, joinedRoom } = useCollaboration();

  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState(new Set());
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Refs for WebRTC
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // Map of userId -> RTCPeerConnection
  const remoteVideosRef = useRef(new Map()); // Map of userId -> video element
  
  // Callback ref for local video to handle mounting
  const setLocalVideoRef = useCallback((element) => {
    localVideoRef.current = element;
    if (element && localStreamRef.current && isConnected) {
      console.log('Video element mounted, setting up stream immediately');
      element.srcObject = localStreamRef.current;
      element.play().catch(console.error);
    }
  }, [isConnected]);
  
  // Request camera and microphone permission
  const requestMediaPermission = useCallback(async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      localStreamRef.current = stream;
      setHasPermission(true);
      
      console.log('Media stream obtained:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        active: stream.active
      });
      
      return stream;
    } catch (error) {
      console.error('Error accessing camera/microphone:', error);
      let errorMessage = 'Camera/microphone access denied';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone permission denied. Please allow access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera/microphone found. Please connect devices and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is being used by another application.';
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
      
      // Create or update video element for this user
      let videoElement = remoteVideosRef.current.get(userId);
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = false; // We want to hear remote audio
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.style.borderRadius = '8px';
        remoteVideosRef.current.set(userId, videoElement);
      }
      videoElement.srcObject = remoteStream;
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-video-ice-candidate', {
          roomId,
          targetUserId: userId,
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Video connection state with ${userId}:`, peerConnection.connectionState);
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
        socket.emit('webrtc-video-offer', {
          roomId,
          targetUserId: userId,
          offer
        });
      }
    } catch (error) {
      console.error('Error creating video offer for', userId, error);
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
        socket.emit('webrtc-video-answer', {
          roomId,
          targetUserId: fromUserId,
          answer
        });
      }
    } catch (error) {
      console.error('Error handling video offer from', fromUserId, error);
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
      console.error('Error handling video answer from', fromUserId, error);
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
      console.error('Error handling video ICE candidate from', fromUserId, error);
    }
  }, []);
  
  // Start video chat
  const startVideoChat = useCallback(async () => {
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
      // Request camera and microphone permission and get stream
      const stream = await requestMediaPermission();
      if (!stream) {
        setIsInitializing(false);
        return;
      }
      
      // Notify server that we joined video chat
      socket.emit('video-chat-join', { roomId });
      
      setIsConnected(true);
      setIsInitializing(false);
      
      // Set up local video after state is updated (this will trigger the useEffect)
      console.log('Video chat connected, video element will be set up via useEffect');
      
      console.log('Video chat started successfully');
    } catch (error) {
      console.error('Error starting video chat:', error);
      setIsInitializing(false);
    }
  }, [socket, roomId, selfInfo, joinedRoom, requestMediaPermission]);
  
  // Stop video chat
  const stopVideoChat = useCallback(() => {
    if (!socket || !roomId) return;
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Clear local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Close all peer connections
    peerConnectionsRef.current.forEach((peerConnection) => {
      peerConnection.close();
    });
    peerConnectionsRef.current.clear();
    
    // Stop all remote video elements
    remoteVideosRef.current.forEach((videoElement) => {
      videoElement.pause();
      videoElement.srcObject = null;
      if (videoElement.parentNode) {
        videoElement.parentNode.removeChild(videoElement);
      }
    });
    remoteVideosRef.current.clear();
    
    // Notify server that we left video chat
    socket.emit('video-chat-leave', { roomId });
    
    setIsConnected(false);
    setConnectedUsers(new Set());
    setHasPermission(false);
    setPermissionError(null);
    setIsMuted(false);
    setIsVideoOff(false);
    
    console.log('Video chat stopped');
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
  
  // Toggle video on/off
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);
  
  // Handle main toggle (start/stop video chat)
  const handleToggle = useCallback(() => {
    if (isConnected) {
      stopVideoChat();
      onToggle(); // Only close dialog when leaving video chat
    } else {
      startVideoChat();
      // Don't call onToggle() when joining - keep dialog open
    }
  }, [isConnected, startVideoChat, stopVideoChat, onToggle]);
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;
    
    const handleWebRTCVideoOffer = ({ fromUserId, offer }) => {
      console.log('Received WebRTC video offer from:', fromUserId);
      handleOffer(fromUserId, offer);
    };
    
    const handleWebRTCVideoAnswer = ({ fromUserId, answer }) => {
      console.log('Received WebRTC video answer from:', fromUserId);
      handleAnswer(fromUserId, answer);
    };
    
    const handleWebRTCVideoIceCandidate = ({ fromUserId, candidate }) => {
      handleIceCandidate(fromUserId, candidate);
    };
    
    const handleUserJoinedVideo = ({ userId, username }) => {
      console.log(`${username} joined video chat`);
      // If we're already connected, create an offer for the new user
      if (isConnected && userId !== selfInfo?.id) {
        createOffer(userId);
      }
    };
    
    const handleUserLeftVideo = ({ userId, username }) => {
      console.log(`${username} left video chat`);
      // Clean up connection for this user
      const peerConnection = peerConnectionsRef.current.get(userId);
      if (peerConnection) {
        peerConnection.close();
        peerConnectionsRef.current.delete(userId);
      }
      
      const videoElement = remoteVideosRef.current.get(userId);
      if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
        if (videoElement.parentNode) {
          videoElement.parentNode.removeChild(videoElement);
        }
        remoteVideosRef.current.delete(userId);
      }
      
      setConnectedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };
    
    socket.on('webrtc-video-offer', handleWebRTCVideoOffer);
    socket.on('webrtc-video-answer', handleWebRTCVideoAnswer);
    socket.on('webrtc-video-ice-candidate', handleWebRTCVideoIceCandidate);
    socket.on('user-joined-video', handleUserJoinedVideo);
    socket.on('user-left-video', handleUserLeftVideo);
    
    return () => {
      socket.off('webrtc-video-offer', handleWebRTCVideoOffer);
      socket.off('webrtc-video-answer', handleWebRTCVideoAnswer);
      socket.off('webrtc-video-ice-candidate', handleWebRTCVideoIceCandidate);
      socket.off('user-joined-video', handleUserJoinedVideo);
      socket.off('user-left-video', handleUserLeftVideo);
    };
  }, [socket, isConnected, selfInfo, handleOffer, handleAnswer, handleIceCandidate, createOffer]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        stopVideoChat();
      }
    };
  }, [isConnected, stopVideoChat]);
  
  // Handle local video display when stream or connection changes
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && isConnected && hasPermission) {
      console.log('Setting up local video stream via useEffect');
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(error => {
        console.error('Error playing local video:', error);
      });
    }
  }, [isConnected, hasPermission]);

  // Update remote videos container when connected users change
  useEffect(() => {
    const remoteVideosContainer = document.getElementById('remote-videos-container');
    if (!remoteVideosContainer) return;
    
    // Clear container
    remoteVideosContainer.innerHTML = '';
    
    // Add all remote video elements
    remoteVideosRef.current.forEach((videoElement, userId) => {
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'remote-video-wrapper';
      videoWrapper.appendChild(videoElement);
      remoteVideosContainer.appendChild(videoWrapper);
    });
  }, [connectedUsers]);
  
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
          className="video-chat-panel"
        >
          <h3>Video Chat</h3>
          <div className="video-chat-error">
            Please join a collaboration room first to use video chat.
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
        className="video-chat-panel"
      >
        <div className="video-chat-header">
          <h3>Video Chat</h3>
          <button 
            className="video-chat-close-button"
            onClick={() => onToggle()}
            title="Close video chat"
          >
            ×
          </button>
        </div>
        
        {permissionError && (
          <div className="video-chat-error">
            {permissionError}
          </div>
        )}
        
        <div className="video-chat-controls">
          <button
            onClick={handleToggle}
            disabled={isInitializing}
            className={`video-chat-button ${isConnected ? 'leave' : 'join'}`}
          >
            {isInitializing ? (
              <>
                <div className="video-chat-spinner" />
                Connecting...
              </>
            ) : isConnected ? (
              <>
                <BsCameraVideoOff size={16} />
                Leave Video
              </>
            ) : (
              <>
                <BsCameraVideo size={16} />
                Join Video
              </>
            )}
          </button>
          
          {isConnected && (
            <>
              <span
                onClick={toggleMute}
                className="video-chat-control-icon"
                role="button"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Unmute' : 'Mute'}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleMute(); }}
              >
                {isMuted ? <BsMicMute size={20} /> : <BsMic size={20} />}
              </span>
              
              <span
                onClick={toggleVideo}
                className="video-chat-control-icon"
                role="button"
                aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleVideo(); }}
              >
                {isVideoOff ? <BsCameraVideoOff size={20} /> : <BsCameraVideo size={20} />}
              </span>
            </>
          )}
        </div>
        
        {isConnected && (
          <>
            <div className="video-chat-status">
              {connectedUsers.size === 0 ? (
                'Waiting for others to join...'
              ) : (
                <>
                  <span className="video-chat-connected-indicator"></span>
                  Connected to {connectedUsers.size} user{connectedUsers.size === 1 ? '' : 's'}
                </>
              )}
            </div>
            
            <div className="video-chat-videos">
              <div className="local-video-container">
                <video
                  ref={setLocalVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="local-video"
                  style={{ display: (!hasPermission || isVideoOff) ? 'none' : 'block' }}
                  onLoadedMetadata={() => console.log('Local video metadata loaded')}
                  onCanPlay={() => console.log('Local video can play')}
                  onError={(e) => console.error('Local video error:', e)}
                />
                {(!hasPermission || isVideoOff) && (
                  <div className="video-placeholder">
                    <BsCameraVideoOff size={32} />
                    <span>{!hasPermission ? 'Camera not available' : 'Camera off'}</span>
                  </div>
                )}
                <div className="video-label">You {isVideoOff ? '(Camera Off)' : ''}</div>
              </div>
              
              <div id="remote-videos-container" className="remote-videos-container">
                {/* Remote videos will be dynamically added here */}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};