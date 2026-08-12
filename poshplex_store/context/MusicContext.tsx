"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export interface Track {
  id: number;
  title: string;
  artist: string;
  audio_url: string;
  cover_url?: string;
  is_active: boolean;
  sort_order: number;
}

interface MusicContextType {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isMinimized: boolean;
  play: () => void;
  pause: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  changeVolume: (v: number) => void;
  toggleMute: () => void;
  toggleMinimize: () => void;
  isVisible: boolean;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false); // Initialized to false so sound plays on click
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pathname = usePathname();

  // Fetch active tracks — cached in sessionStorage to avoid re-fetching on every page mount
  useEffect(() => {
    const fetchTracks = async () => {
      // Check session cache first
      try {
        const cached = sessionStorage.getItem("poshplex_music_tracks");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTracks(parsed);
            return; // Skip network call entirely
          }
        }
      } catch { /* ignore parse errors */ }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API}/api/v1/music/tracks`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          setTracks(data);
          // Cache for this browser session
          try { sessionStorage.setItem("poshplex_music_tracks", JSON.stringify(data)); } catch { }
        }
      } catch {
        // Backend offline or timeout — load fallback demo tracks silently
        clearTimeout(timeout);
        setTracks([]);
      }
    };
    fetchTracks();
  }, []);

  // Sync settings and custom events
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedVolume = localStorage.getItem("poshplex_music_volume");
      if (savedVolume !== null) setVolume(parseFloat(savedVolume));
      const savedMinimized = localStorage.getItem("poshplex_music_minimized");
      if (savedMinimized !== null) setIsMinimized(savedMinimized === "true");
    }

    const handleToggle = () => {
      setIsMinimized(prev => !prev);
    };
    document.addEventListener("toggle-music", handleToggle);
    return () => document.removeEventListener("toggle-music", handleToggle);
  }, []);

  const currentTrack = tracks[currentIndex] || null;

  // Track audio object loading
  useEffect(() => {
    if (!currentTrack) return;

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const audioUrlToPlay = currentTrack.audio_url.startsWith("http")
      ? currentTrack.audio_url
      : `${API}${currentTrack.audio_url}`;

    // Reuse the existing Audio element instance if available to satisfy browser interaction security policies
    const isSameSrc = audioRef.current && (audioRef.current.src === audioUrlToPlay || audioRef.current.src.endsWith(currentTrack.audio_url));
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrlToPlay);
    } else if (!isSameSrc) {
      audioRef.current.src = audioUrlToPlay;
      audioRef.current.load();
    }

    const audio = audioRef.current;
    audio.volume = isMuted ? 0 : volume;
    audio.muted = isMuted;

    const handleTrackEnded = () => {
      if (tracks.length > 0) {
        setCurrentIndex((prev) => (prev + 1) % tracks.length);
        setIsPlaying(true);
      }
    };

    audio.addEventListener("ended", handleTrackEnded);

    if (isPlaying && audio.paused) {
      audio.play().catch((err) => {
        console.warn("Audio playback failed on track load:", err);
        setIsPlaying(false);
      });
    }

    return () => {
      audio.removeEventListener("ended", handleTrackEnded);
      // Removed audio.pause() during track transitions so the synchronous play isn't immediately stopped
    };
  }, [currentTrack]);

  // Sync toggle state
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.dispatchEvent(new CustomEvent("music-state", { detail: { isPlaying } }));
    }
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Sync volume level settings
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
    if (typeof window !== "undefined") {
      localStorage.setItem("poshplex_music_volume", volume.toString());
    }
  }, [volume, isMuted]);

  const play = () => {
    setIsMuted(false);
    setIsPlaying(true);
  };
  const pause = () => setIsPlaying(false);

  const skipNext = () => {
    if (tracks.length === 0) return;
    const nextIdx = (currentIndex + 1) % tracks.length;
    setCurrentIndex(nextIdx);
    setIsPlaying(true);

    const nextTrack = tracks[nextIdx];
    if (nextTrack && audioRef.current) {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const audioUrlToPlay = nextTrack.audio_url.startsWith("http")
        ? nextTrack.audio_url
        : `${API}${nextTrack.audio_url}`;
      audioRef.current.src = audioUrlToPlay;
      audioRef.current.load();
      audioRef.current.play().catch((err) => console.warn("Sync skipNext play failed:", err));
    }
  };

  const skipPrev = () => {
    if (tracks.length === 0) return;
    const prevIdx = (currentIndex - 1 + tracks.length) % tracks.length;
    setCurrentIndex(prevIdx);
    setIsPlaying(true);

    const prevTrack = tracks[prevIdx];
    if (prevTrack && audioRef.current) {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const audioUrlToPlay = prevTrack.audio_url.startsWith("http")
        ? prevTrack.audio_url
        : `${API}${prevTrack.audio_url}`;
      audioRef.current.src = audioUrlToPlay;
      audioRef.current.load();
      audioRef.current.play().catch((err) => console.warn("Sync skipPrev play failed:", err));
    }
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    if (v > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleMinimize = () => {
    const nextMinimized = !isMinimized;
    setIsMinimized(nextMinimized);
    if (typeof window !== "undefined") {
      localStorage.setItem("poshplex_music_minimized", nextMinimized.toString());
    }
  };

  // Checkout page suppression
  const isVisible = pathname !== "/checkout" && pathname !== "/payment";

  return (
    <MusicContext.Provider value={{
      tracks,
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
    }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used inside a MusicProvider");
  return context;
};
