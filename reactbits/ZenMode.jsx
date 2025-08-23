'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../src/styles/Editor/zen-mode.css';

// Define available tracks
const AUDIO_TRACKS = [
  {
    id: 'calming-rain',
    name: 'Calming Rain',
    path: '/music/calming-rain.mp3',
    emoji: '🌧️',
  },
  // Ready for more tracks in the future
];

export default function ZenMode({ isActive }) { // Removed onClose prop
  const audioRef = useRef(null);
  const [volume, setVolume] = useState(50); // Keep volume control logic if needed externally later, or remove if truly headless
  const [currentTrackId, setCurrentTrackId] = useState(AUDIO_TRACKS[0].id); // Keep track selection logic if needed externally later
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(null); // Store error details
  const [isPlaying, setIsPlaying] = useState(false); // Track playback state
  // Removed isMinimized state

  // NOTE: minimizeTriggeredRef is removed as it's no longer the correct approach

  const currentTrack = AUDIO_TRACKS.find(track => track.id === currentTrackId) || AUDIO_TRACKS[0];

  // --- Consolidated Audio Logic ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('[ZenMode] Effect triggered:', { isActive, currentTrackId, audioError: !!audioError });

    const attemptPlay = () => {
      console.log('[ZenMode] Attempting play...');
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[ZenMode] Playback started successfully.');
            setIsPlaying(true);
            setAudioError(null); // Clear previous errors on successful play
          })
          .catch(error => {
            console.error('[ZenMode] Error during play attempt:', error);
            // Don't set audioError here if it's just an interruption
            if (error.name !== 'AbortError') {
                 setAudioError({ message: 'Playback failed.', details: error });
            }
            setIsPlaying(false);
          });
      } else {
         // Fallback for browsers not returning a promise (older?)
         setIsPlaying(true);
         setAudioError(null);
      }
    };

    if (isActive && !audioError) {
      // If track changed or audio wasn't playing, load and play
      if (audio.currentSrc !== audio.src || !isPlaying) {
         console.log('[ZenMode] Loading new track or resuming...');
         audio.load(); // Important when changing src or after error
         // Play is often best initiated after 'canplaythrough' or 'loadeddata',
         // but browsers might block autoplay, so we try directly.
         // The 'onLoadedData' handler will also try to play if needed.
         attemptPlay();
      } else if (!isPlaying) {
          // If same track but paused, just play
          attemptPlay();
      }
    } else {
      console.log('[ZenMode] Pausing audio.');
      audio.pause();
      setIsPlaying(false);
    }

    // Cleanup function
    // Cleanup function: Pause audio only when the component becomes inactive (isActive goes false)
    return () => {
      if (audio) {
        console.log('[ZenMode] Cleanup: Pausing audio as component becomes inactive.');
        audio.pause();
        setIsPlaying(false);
      }
    };
  // Rerun audio logic when active state, track, or error status changes
  // isMinimized does NOT affect audio playback directly
  }, [isActive, currentTrackId, audioError]);

  // --- Volume Control ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      console.log('[ZenMode] Volume set to:', volume);
    }
  }, [volume]);

  // --- Event Handlers ---
  const handleAudioLoaded = () => {
    console.log('[ZenMode] Event: onLoadedData - Audio data loaded for:', currentTrack.path);
    setAudioLoaded(true);
    setAudioError(null); // Clear error on successful load
    // If component is active, try playing now that data is loaded
    if (isActive && audioRef.current && !isPlaying) {
        console.log('[ZenMode] Event: onLoadedData - Attempting play post-load...');
        const playPromise = audioRef.current.play();
         if (playPromise !== undefined) {
            playPromise.catch(error => {
                 console.error('[ZenMode] Error during play attempt post-load:', error);
                 if (error.name !== 'AbortError') {
                    setAudioError({ message: 'Playback failed post-load.', details: error });
                 }
                 setIsPlaying(false);
            });
         }
    }
  };

  const handleAudioError = (event) => {
    const error = event.target.error;
    const errorCode = error ? error.code : 'N/A';
    const errorMessage = error ? error.message : 'Unknown error';
    // Map common error codes to user-friendly messages
    let detailedMessage = `Audio failed to load (Code: ${errorCode}).`;
    switch (errorCode) {
        case MediaError.MEDIA_ERR_ABORTED:
            detailedMessage += ' The fetching process was aborted by the user.';
            break;
        case MediaError.MEDIA_ERR_NETWORK:
            detailedMessage += ' A network error caused the audio download to fail.';
            break;
        case MediaError.MEDIA_ERR_DECODE:
            detailedMessage += ' The audio playback was aborted due to a corruption problem or because the audio used features your browser did not support.';
            break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            detailedMessage += ' The audio could not be loaded, either because the server or network failed or because the format is not supported.';
            break;
        default:
            detailedMessage += ` An unknown error occurred: ${errorMessage}`;
    }

    console.error('[ZenMode] Event: onError - Audio Error:', {
      path: currentTrack.path,
      errorCode: errorCode,
      errorMessage: errorMessage,
      networkState: event.target.networkState,
      readyState: event.target.readyState,
      fullErrorObject: error // Log the full error object for deep dive
    });

    setAudioError({ message: detailedMessage, details: error });
    setAudioLoaded(false);
    setIsPlaying(false);
  };

   const handleCanPlay = () => {
     console.log('[ZenMode] Event: onCanPlay - Browser estimates it can play:', currentTrack.path);
     // You could potentially trigger play here too, but handleLoadedData is often sufficient
   };

   const handleWaiting = () => {
     console.log('[ZenMode] Event: onWaiting - Playback stopped due to temporary lack of data (buffering).');
   };

   const handlePlaying = () => {
     console.log('[ZenMode] Event: onPlaying - Playback has started or resumed.');
     setIsPlaying(true); // Ensure state is correct
   };

   const handlePause = () => {
     console.log('[ZenMode] Event: onPause - Playback has been paused.');
     setIsPlaying(false); // Ensure state is correct
   };

   // --- Button Handlers Removed ---
   // handleMinimizeClick, handleRestoreClick, handleExitClick are removed as there is no UI.

  // Render null if the component is not active
  if (!isActive) {
      // console.log('[ZenMode] Component inactive, rendering null.');
      // Ensure audio stops if component becomes inactive suddenly
      if (audioRef.current && !audioRef.current.paused) {
          console.log('[ZenMode] Ensuring audio pause on inactive render.');
          audioRef.current.pause();
      }
      return null;
  }

  // Component is active: Render only the audio element (conditionally on error)
  // The UI (overlay, content, controls) is completely removed.
  return (
    <>
      {/* Audio element is always rendered when active and no error */}
      {!audioError && (
        <audio
          ref={audioRef}
          src={currentTrack.path}
          loop
          preload="auto"
          style={{ display: 'none' }} // Keep hidden, it's controlled programmatically
          onLoadedData={handleAudioLoaded}
          onError={handleAudioError}
          onCanPlay={handleCanPlay}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onPause={handlePause}
        />
      )}

      {/* Render error message if audio fails, but without the full UI */}
      {audioError && (
          <div style={{ position: 'fixed', bottom: '10px', left: '10px', background: 'rgba(255,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '5px', zIndex: 1000 }}>
              <p><strong>Zen Mode Audio Error:</strong> {audioError.message || 'Unknown error'}</p>
              <p>Path: {currentTrack.path}</p>
              <button onClick={() => setAudioError(null)} style={{ marginLeft: '10px', padding: '2px 5px' }}>Retry</button>
          </div>
      )}
      {/* No UI Overlay is rendered */}
    </>
  );
}