"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import * as Tone from "tone";
import type { Note, SongData } from "@/lib/types";
import { scheduleNote, stopAllNotes, initAudio } from "@/lib/piano";

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  speed: number;
  activeNotes: Set<number>;
}

export function usePianoPlayer(songData: SongData | undefined) {
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    speed: 1,
    activeNotes: new Set(),
  });

  const duration = useMemo(() => songData?.duration || 0, [songData]);

  const animFrameRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(1);
  const songDataRef = useRef(songData);
  const scheduledRef = useRef(false);

  // Keep songDataRef in sync
  useEffect(() => {
    songDataRef.current = songData;
    scheduledRef.current = false;
  }, [songData]);

  // Schedule all notes onto Tone.Transport
  const scheduleAllNotes = useCallback((notes: Note[], speed: number) => {
    const transport = Tone.getTransport();
    transport.cancel(); // Clear previous schedule
    transport.position = 0;

    for (const note of notes) {
      const scaledTime = note.startTime / speed;
      const scaledDuration = note.duration / speed;
      scheduleNote(note.midi, scaledTime, scaledDuration, note.velocity);
    }

    scheduledRef.current = true;
  }, []);

  // Visual-only rAF loop — reads Transport.seconds to drive activeNotes
  const tickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    tickRef.current = () => {
      const data = songDataRef.current;
      if (!isPlayingRef.current || !data) return;

      const transport = Tone.getTransport();
      const transportTime = transport.seconds;
      // Convert transport time back to song time (accounting for speed)
      const songTime = transportTime * speedRef.current;

      // Check if playback has ended
      if (songTime >= data.duration) {
        isPlayingRef.current = false;
        transport.stop();
        transport.position = 0;
        stopAllNotes();
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          currentTime: 0,
          activeNotes: new Set(),
        }));
        return;
      }

      // Find currently active notes (visual only — audio is pre-scheduled)
      // Use minimum visual duration so short notes don't get missed between frames
      const active = new Set<number>();
      const minVisualDuration = 0.08; // 80ms minimum for visual
      for (const note of data.notes) {
        const visualEnd = note.startTime + Math.max(note.duration, minVisualDuration);
        if (songTime >= note.startTime && songTime < visualEnd) {
          active.add(note.midi);
        }
      }

      setState((prev) => ({
        ...prev,
        currentTime: songTime,
        activeNotes: active,
      }));

      animFrameRef.current = requestAnimationFrame(() => tickRef.current!());
    };
  });

  const play = useCallback(async () => {
    await initAudio();
    const data = songDataRef.current;
    if (!data) return;

    const transport = Tone.getTransport();

    // Schedule notes if not already done or if speed changed
    if (!scheduledRef.current) {
      scheduleAllNotes(data.notes, speedRef.current);
    }

    isPlayingRef.current = true;
    transport.start();
    setState((prev) => ({ ...prev, isPlaying: true }));
    animFrameRef.current = requestAnimationFrame(() => tickRef.current!());
  }, [scheduleAllNotes]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    const transport = Tone.getTransport();
    transport.pause();
    cancelAnimationFrame(animFrameRef.current);
    stopAllNotes();
    setState((prev) => ({ ...prev, isPlaying: false, activeNotes: new Set() }));
  }, []);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    cancelAnimationFrame(animFrameRef.current);
    stopAllNotes();
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
      activeNotes: new Set(),
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    speedRef.current = speed;
    scheduledRef.current = false; // Force reschedule

    const transport = Tone.getTransport();
    const wasPlaying = isPlayingRef.current;
    const currentSongTime = transport.seconds * speedRef.current;

    if (wasPlaying) {
      transport.stop();
      isPlayingRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      stopAllNotes();
    }

    // Reschedule at new speed
    const data = songDataRef.current;
    if (data) {
      scheduleAllNotes(data.notes, speed);
      // Restore position
      transport.position = currentSongTime / speed;
    }

    if (wasPlaying) {
      isPlayingRef.current = true;
      transport.start();
      animFrameRef.current = requestAnimationFrame(() => tickRef.current!());
    }

    setState((prev) => ({ ...prev, speed }));
  }, [scheduleAllNotes]);

  const seek = useCallback((time: number) => {
    const transport = Tone.getTransport();
    const transportTime = time / speedRef.current;
    transport.position = transportTime;
    stopAllNotes();
    setState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
      stopAllNotes();
    };
  }, []);

  return {
    ...state,
    duration,
    play,
    pause,
    stop,
    setSpeed,
    seek,
  };
}
