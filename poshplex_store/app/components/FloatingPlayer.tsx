"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Play, Pause, SkipForward, SkipBack, Minimize2, Music, Repeat, List, X } from "lucide-react";
import { useMusic } from "../../context/MusicContext";

export const FloatingPlayer: React.FC = () => {
  const {
    tracks,
    currentTrack,
    currentIndex,
    isPlaying,
    isLooping,
    isMinimized,
    currentTime,
    duration,
    play,
    pause,
    skipNext,
    skipPrev,
    toggleLoop,
    seek,
    playTrack,
    toggleMinimize,
    isVisible
  } = useMusic();

  const [showPlaylist, setShowPlaylist] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    const startTimer = () => {
      // 6 seconds delay on all devices for faster perceived load
      const delay = 6000;
      timer = setTimeout(() => setIsReady(true), delay);
    };

    if (document.readyState === 'complete') {
      startTimer();
    } else {
      window.addEventListener('load', startTimer);
    }
    
    return () => {
      window.removeEventListener('load', startTimer);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => setIsMobile(window.innerWidth <= 768);
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Click outside to minimize on mobile view or close playlist
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Close playlist if clicking outside
      if (showPlaylist && !target.closest('.playlist-menu') && !target.closest('.playlist-btn')) {
        setShowPlaylist(false);
      }

      // Auto minimize on mobile (if not clicking toggle button)
      if (!isMinimized && isMobile) {
        const isToggleButton = target.closest(".music-toggle-btn") || target.closest("button")?.outerHTML.includes("toggle-music");
        if (playerRef.current && !playerRef.current.contains(target) && !isToggleButton && !target.closest('.playlist-menu')) {
          toggleMinimize();
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMinimized, isMobile, showPlaylist, toggleMinimize]);

  if (!isReady || !isVisible || !currentTrack) return null;

  if (isMinimized) {
    if (isMobile) return null; // Completely hide minimized floating circle badge on mobile viewports
    return (
      <div 
        onClick={toggleMinimize}
        className="floating-audio-player minimized"
        style={{
          width: 56,
          height: 56,
          background: isPlaying ? "#e11d48" : "var(--bg-secondary)",
          border: isPlaying ? "none" : "2px solid var(--text-main)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: isPlaying ? "0 4px 14px rgba(225, 29, 72, 0.4)" : "0 10px 30px rgba(0,0,0,0.3)",
          transition: "all 0.3s ease",
          animation: isPlaying ? "pulse 2s infinite" : "none"
        }}
        title="Restore Player"
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        <Music size={20} style={{ 
          color: isPlaying ? "#ffffff" : "var(--text-muted)",
          animation: isPlaying ? "spin 4s linear infinite" : "none"
        }} />
        
        {/* Playback Indicator */}
        <div style={{
          position: "absolute",
          bottom: 2,
          right: 2,
          width: 14,
          height: 14,
          background: isPlaying ? "#e11d48" : "var(--text-muted)",
          borderRadius: "50%",
          border: "2px solid var(--bg-secondary)"
        }} />
        
        <style dangerouslySetInnerHTML={{__html: `
          .floating-audio-player {
            position: fixed !important;
            z-index: 9999 !important;
            transition: all 0.3s ease !important;
          }
          @media (min-width: 769px) {
            .floating-audio-player {
              top: 50% !important;
              left: 30px !important;
              bottom: auto !important;
              right: auto !important;
            }
          }
          @media (max-width: 768px) {
            .floating-audio-player {
              top: auto !important;
              left: auto !important;
              bottom: 84px !important;
              right: 16px !important;
            }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  // Format time (e.g. 01:30)
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTime = dragTime !== null ? dragTime : currentTime;

  return (
    <div 
      className="floating-audio-player maximized"
      ref={playerRef}
      style={{
        background: "rgba(25, 25, 25, 0.65)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 24,
        padding: "16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        maxWidth: 320,
        width: "calc(100% - 32px)",
        position: "relative"
      }}
    >
      {/* Minimize Button (Top Right Absolute) */}
      <button 
        onClick={toggleMinimize}
        className="minimize-btn"
        style={{ 
          position: "absolute",
          top: 14,
          right: 18,
          background: "transparent", 
          border: "none", 
          color: "#888", 
          cursor: "pointer", 
          padding: 4,
          display: "flex"
        }}
        title="Minimize player"
      >
        <X size={14} />
      </button>

      {/* Header: Track Title */}
      <div style={{ padding: "0 20px" }}>
        <h4 style={{ 
          fontSize: 12, 
          fontWeight: 700, 
          color: "#ffffff", 
          margin: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textTransform: "uppercase",
          letterSpacing: "1px",
          textAlign: "center"
        }}>
          {currentTrack.title}
        </h4>
      </div>

      {/* Progress Bar Container */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 10, color: "#888", minWidth: 32, textAlign: "right" }}>
          {formatTime(displayTime)}
        </span>
        
        <input 
          type="range"
          min={0}
          max={duration || 100}
          step="0.1"
          value={displayTime || 0}
          onChange={(e) => setDragTime(parseFloat(e.target.value))}
          onPointerUp={(e) => {
            const time = parseFloat(e.currentTarget.value);
            seek(time);
            setDragTime(null);
          }}
          className="player-slider"
          style={{ flex: 1 }}
        />
        
        <span style={{ fontSize: 10, color: "#888", minWidth: 32 }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Bottom Controls Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
        
        {/* Loop */}
        <button 
          onClick={toggleLoop}
          aria-label="Toggle Loop"
          style={{ background: "transparent", border: "none", color: isLooping ? "#fff" : "#666", cursor: "pointer", display: "flex", padding: 4 }}
        >
          <Repeat size={16} />
        </button>

        {/* Previous */}
        <button 
          suppressHydrationWarning
          onClick={skipPrev}
          aria-label="Previous Track"
          style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex", padding: 4 }}
        >
          <SkipBack size={18} fill="currentColor" />
        </button>

        {/* Play / Pause */}
        <button 
          suppressHydrationWarning
          onClick={isPlaying ? pause : play}
          aria-label={isPlaying ? "Pause Music" : "Play Music"}
          style={{ 
            background: "transparent", 
            color: "#ffffff", 
            border: "none", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            cursor: "pointer",
            padding: 4
          }}
        >
          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
        </button>

        {/* Next */}
        <button 
          suppressHydrationWarning
          onClick={skipNext}
          aria-label="Next Track"
          style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex", padding: 4 }}
        >
          <SkipForward size={18} fill="currentColor" />
        </button>

        {/* Playlist Menu Toggle */}
        <div style={{ position: "relative" }}>
          <button 
            className="playlist-btn"
            onClick={() => setShowPlaylist(!showPlaylist)}
            aria-label="Toggle Playlist"
            style={{ background: "transparent", border: "none", color: showPlaylist ? "#fff" : "#888", cursor: "pointer", display: "flex", padding: 4 }}
          >
            <List size={16} />
          </button>
          
          {/* Playlist Dropdown */}
          {showPlaylist && (
            <div className="playlist-menu" style={{
              position: "absolute",
              bottom: "100%",
              right: -10,
              marginBottom: 16,
              background: "rgba(20, 20, 20, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 16,
              padding: 12,
              width: 220,
              maxHeight: 250,
              overflowY: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              zIndex: 10
            }}>
              <h5 style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 10px 0" }}>Playlist</h5>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tracks.map((track, idx) => (
                  <div 
                    key={track.id}
                    onClick={() => playTrack(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 8,
                      background: currentIndex === idx ? "rgba(255,255,255,0.1)" : "transparent"
                    }}
                  >
                    <Music size={12} style={{ color: currentIndex === idx ? "#e11d48" : "#666" }} />
                    <span style={{ 
                      fontSize: 11, 
                      color: currentIndex === idx ? "#fff" : "#ccc",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: currentIndex === idx ? 700 : 400
                    }}>
                      {track.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .floating-audio-player {
          position: fixed !important;
          z-index: 9999 !important;
          transition: all 0.3s ease !important;
        }
        @media (min-width: 769px) {
          .floating-audio-player {
            top: 50% !important;
            left: 30px !important;
            bottom: auto !important;
            right: auto !important;
          }
        }
        @media (max-width: 768px) {
          .floating-audio-player {
            top: auto !important;
            left: 0 !important;
            right: 0 !important;
            margin: 0 auto !important;
            bottom: 84px !important;
          }
          .floating-audio-player.minimized {
            display: none !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        /* Custom Range Slider */
        .player-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .player-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .player-slider::-webkit-slider-thumb:hover {
          transform: scale(1.3);
        }
        .player-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: none;
        }
      `}} />
    </div>
  );
};
export default FloatingPlayer;
