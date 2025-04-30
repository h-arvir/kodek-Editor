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

export default function ZenMode({ isActive, onClose }) {
  const audioRef = useRef(null);
  const [volume, setVolume] = useState(50);
  const [currentTrackId, setCurrentTrackId] = useState(AUDIO_TRACKS[0].id);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  
  const currentTrack = AUDIO_TRACKS.find(track => track.id === currentTrackId) || AUDIO_TRACKS[0];
  
  useEffect(() => {
    if (isActive && audioRef.current && !audioError) {
      try {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Error playing audio:', error);
            setAudioError(true);
          });
        }
      } catch (error) {
        console.error('Error playing audio:', error);
        setAudioError(true);
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isActive, audioError]);
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);
  
  // Handle track change
  useEffect(() => {
    if (audioRef.current && !audioError) {
      audioRef.current.pause();
      audioRef.current.load();
      if (isActive) {
        try {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error('Error playing audio after track change:', error);
              setAudioError(true);
            });
          }
        } catch (error) {
          console.error('Error playing audio after track change:', error);
          setAudioError(true);
        }
      }
    }
  }, [currentTrackId, isActive, audioError]);
  
  const handleAudioLoaded = () => {
    console.log('Audio loaded successfully:', currentTrack.path);
    setAudioLoaded(true);
    setAudioError(false);
  };
  
  const handleAudioError = (event) => {
    console.error('Audio failed to load:', {
      path: currentTrack.path,
      error: event.target.error,
      networkState: event.target.networkState,
      readyState: event.target.readyState
    });
    setAudioError(true);
  };
  
  if (!isActive) return null;
  
  return (
    <div className="zen-mode-overlay">
      <div className="zen-mode-content">
        <h2>Zen Mode</h2>
        
        {audioError ? (
          <div className="error-message">
            <p>Unable to load the audio file. The MP3 file may be missing or corrupted.</p>
            <p>Please add a valid MP3 file named "calming-rain.mp3" to the "public/music" directory.</p>
            <p>Current path: {currentTrack.path}</p>
            <p className="note">Note: The current placeholder is not a valid MP3 file. You need to replace it with an actual MP3 audio file.</p>
          </div>
        ) : (
          <>
            <p>Relax and focus with ambient sounds.</p>
            
            <div className="track-selection">
              <p className="track-label">Current track: {currentTrack.emoji} {currentTrack.name}</p>
              
              {AUDIO_TRACKS.length > 1 && (
                <div className="track-buttons">
                  {AUDIO_TRACKS.map(track => (
                    <button
                      key={track.id}
                      onClick={() => setCurrentTrackId(track.id)}
                      className={`track-button ${currentTrackId === track.id ? 'active' : ''}`}
                    >
                      {track.emoji} {track.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="volume-control-container">
              <label 
                htmlFor="volume-control" 
                className="volume-label"
              >
                Volume: {volume}%
              </label>
              <input
                id="volume-control"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="volume-slider"
              />
            </div>
          </>
        )}
        
        <button
          onClick={onClose}
          className="exit-button"
        >
          Exit Zen Mode
        </button>
      </div>
      
      {!audioError && (
        <audio
          ref={audioRef}
          src={currentTrack.path}
          loop
          preload="auto"
          style={{ display: 'none' }}
          onLoadedData={handleAudioLoaded}
          onError={handleAudioError}
        />
      )}
    </div>
  );
} 