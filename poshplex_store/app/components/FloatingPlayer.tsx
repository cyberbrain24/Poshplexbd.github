"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Minimize2, Maximize2, Music } from "lucide-react";
import { useMusic } from "../../context/MusicContext";

export const FloatingPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    isMinimized,
    play,
    pause,
    skipNext,
    skipPrev,
    changeVolume,
    toggleMute,
    toggleMinimize,
    isVisible
  } = useMusic();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => {
        setIsMobile(window.innerWidth <= 768);
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Click outside to minimize on mobile view
  useEffect(() => {
    if (isMinimized) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (isMobile) {
        const target = e.target as HTMLElement;
        // Avoid auto-minimizing when clicking the bottom sticky nav or its music icon
        const isBottomNav = target.closest(".mobile-bottom-nav") || target.closest("button")?.outerHTML.includes("toggle-music");
        if (playerRef.current && !playerRef.current.contains(target) && !isBottomNav) {
          toggleMinimize();
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMinimized, isMobile, toggleMinimize]);

  if (!isVisible || !currentTrack) return null;

  if (isMinimized) {
    if (isMobile) return null; // Completely hide minimized floating circle badge on mobile viewports
    return (
      <div 
        onClick={toggleMinimize}
        className="floating-audio-player minimized"
        style={{
          width: 56,
          height: 56,
          background: "var(--bg-secondary)",
          border: "2px solid var(--text-main)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          transition: "transform 0.3s ease",
          animation: isPlaying ? "pulse 2s infinite" : "none"
        }}
        title="Restore Player"
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        {currentTrack.cover_url ? (
          <img 
            src={currentTrack.cover_url} 
            alt="disc" 
            style={{ 
              width: "100%", 
              height: "100%", 
              borderRadius: "50%", 
              objectFit: "cover",
              animation: isPlaying ? "spin 6s linear infinite" : "none" 
            }} 
          />
        ) : (
          <Music size={20} style={{ color: isPlaying ? "#e11d48" : "var(--text-muted)" }} />
        )}
        
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

  return (
    <div 
      className="floating-audio-player maximized"
      ref={playerRef}
      style={{
        background: "rgba(30, 30, 30, 0.85)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 16,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        maxWidth: 360,
        width: "calc(100% - 60px)"
      }}
    >
      {/* Cover Icon */}
      <div style={{ position: "relative", width: 44, height: 44, background: "#2e2e2e", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Music size={18} style={{ color: isPlaying ? "#e11d48" : "#888888", animation: isPlaying ? "spin 6s linear infinite" : "none" }} />
      </div>

      {/* Track Details Info */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <h4 style={{ 
          fontSize: 13, 
          fontWeight: 700, 
          color: "#ffffff", 
          margin: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}>
          {currentTrack.title}
        </h4>
        <span style={{ 
          fontSize: 11, 
          color: "#cccccc", 
          display: "block",
          marginTop: 2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}>
          Store Soundtrack
        </span>
      </div>

      {/* Control Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Previous */}
        <button 
          onClick={skipPrev}
          style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex", padding: 4 }}
        >
          <SkipBack size={14} fill="currentColor" />
        </button>

        {/* Play / Pause */}
        <button 
          onClick={isPlaying ? pause : play}
          style={{ 
            background: "#ffffff", 
            color: "#1e1e1e", 
            border: "none", 
            borderRadius: "50%", 
            width: 28, 
            height: 28, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            cursor: "pointer" 
          }}
        >
          {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>

        {/* Next */}
        <button 
          onClick={skipNext}
          style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex", padding: 4 }}
        >
          <SkipForward size={14} fill="currentColor" />
        </button>

        {/* Volume controls */}
        <div 
          style={{ position: "relative", display: "flex", alignItems: "center" }}
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button 
            onClick={toggleMute}
            style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex", padding: 4 }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          
          {showVolumeSlider && (
            <div 
              style={{
                position: "absolute",
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(30, 30, 30, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "8px 4px",
                borderRadius: 8,
                display: "flex",
                height: 80,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8
              }}
            >
              <input 
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                style={{
                  writingMode: "vertical-lr",
                  direction: "rtl",
                  height: "100%",
                  cursor: "pointer",
                  accentColor: "#ffffff"
                }}
              />
            </div>
          )}
        </div>

        {/* Minimize */}
        <button 
          onClick={toggleMinimize}
          className="minimize-btn"
          style={{ background: "transparent", border: "none", color: "#cccccc", cursor: "pointer", display: "flex", padding: 4 }}
          title="Minimize player"
        >
          <Minimize2 size={14} />
        </button>
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
            left: auto !important;
            bottom: 84px !important;
            right: 16px !important;
          }
          .floating-audio-player.minimized {
            display: none !important;
          }
          .minimize-btn {
            display: none !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
};
export default FloatingPlayer;
