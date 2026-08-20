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
  currentIndex: number;
  isPlaying: boolean;
  isLooping: boolean;
  volume: number;
  isMuted: boolean;
  isMinimized: boolean;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  toggleLoop: () => void;
  seek: (time: number) => void;
  playTrack: (index: number) => void;
  changeVolume: (v: number) => void;
  toggleMute: () => void;
  toggleMinimize: () => void;
  isVisible: boolean;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [hasRandomized, setHasRandomized] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const isLoopingRef = useRef<boolean>(false);
  const pathname = usePathname();

  // Sync refs to avoid stale closures in event listeners
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const cached = sessionStorage.getItem("poshplex_music_tracks");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTracks(parsed);
            return;
          }
        }
      } catch { }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API}/api/v1/music/tracks`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          setTracks(data);
          try { sessionStorage.setItem("poshplex_music_tracks", JSON.stringify(data)); } catch { }
        }
      } catch {
        clearTimeout(timeout);
        setTracks([]);
      }
    };
    fetchTracks();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedVolume = localStorage.getItem("poshplex_music_volume");
      if (savedVolume !== null) setVolume(parseFloat(savedVolume));
      const savedMinimized = localStorage.getItem("poshplex_music_minimized");
      if (savedMinimized !== null) setIsMinimized(savedMinimized === "true");
    }

    const handleToggle = () => setIsMinimized(prev => !prev);
    document.addEventListener("toggle-music", handleToggle);
    return () => document.removeEventListener("toggle-music", handleToggle);
  }, []);

  useEffect(() => {
    if (tracks.length > 0 && !hasRandomized) {
      setCurrentIndex(Math.floor(Math.random() * tracks.length));
      setHasRandomized(true);
    }
  }, [tracks, hasRandomized]);

  const currentTrack = tracks[currentIndex] || null;

  useEffect(() => {
    if (!currentTrack) return;

    const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const audioUrlToPlay = currentTrack.audio_url.startsWith("http")
      ? currentTrack.audio_url
      : `${API}${currentTrack.audio_url}`;

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
    audio.loop = isLoopingRef.current;

    const handleTrackEnded = () => {
      // If looping, HTMLAudioElement with loop=true handles it automatically.
      // But just in case loop isn't supported or we want explicit control:
      if (!isLoopingRef.current && tracksRef.current.length > 0) {
        setCurrentIndex((prev) => (prev + 1) % tracksRef.current.length);
        setIsPlaying(true);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener("ended", handleTrackEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    if (isPlaying && audio.paused) {
      audio.play().catch((err) => {
        console.warn("Audio playback failed on track load:", err);
        setIsPlaying(false);
      });
    }

    return () => {
      audio.removeEventListener("ended", handleTrackEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [currentTrack]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.dispatchEvent(new CustomEvent("music-state", { detail: { isPlaying } }));
    }
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

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
    if (audioRef.current) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  };
  
  const pause = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const toggleLoop = () => setIsLooping(prev => !prev);
  
  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const playTrack = (index: number) => {
    if (index >= 0 && index < tracks.length) {
      setCurrentIndex(index);
      setIsPlaying(true);
      
      // On direct track selection, we must handle the src change immediately 
      // within the click event loop for iOS Safari compatibility.
      const track = tracks[index];
      if (track && audioRef.current) {
        const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const audioUrlToPlay = track.audio_url.startsWith("http")
          ? track.audio_url
          : `${API}${track.audio_url}`;
        
        const isSameSrc = audioRef.current.src === audioUrlToPlay || audioRef.current.src.endsWith(track.audio_url);
        if (!isSameSrc) {
          audioRef.current.src = audioUrlToPlay;
          audioRef.current.load();
        }
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  };

  const skipNext = () => {
    if (tracks.length === 0) return;
    const nextIdx = (currentIndex + 1) % tracks.length;
    playTrack(nextIdx);
  };

  const skipPrev = () => {
    if (tracks.length === 0) return;
    const prevIdx = (currentIndex - 1 + tracks.length) % tracks.length;
    playTrack(prevIdx);
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    if (v > 0) setIsMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = v;
      if (v > 0) audioRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      if (isMuted && volume === 0) {
        changeVolume(0.5); // restore some volume if unmuting from 0
      }
    }
  };

  const toggleMinimize = () => {
    const nextMinimized = !isMinimized;
    setIsMinimized(nextMinimized);
    if (typeof window !== "undefined") {
      localStorage.setItem("poshplex_music_minimized", nextMinimized.toString());
    }
  };

  const isVisible = pathname !== "/checkout" && pathname !== "/payment";

  return (
    <MusicContext.Provider value={{
      tracks,
      currentTrack,
      currentIndex,
      isPlaying,
      isLooping,
      volume,
      isMuted,
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
