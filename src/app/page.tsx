"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Piano, ArrowLeft } from "lucide-react";
import SongInput from "@/components/SongInput";
import PianoKeyboard, { getWhiteKeyCount } from "@/components/PianoKeyboard";
import FallingNotes from "@/components/FallingNotes";
import PlaybackControls from "@/components/PlaybackControls";
import SongInfo from "@/components/SongInfo";
import SheetMusic from "@/components/SheetMusic";
import ProcessingStatus from "@/components/ProcessingStatus";
import { usePianoPlayer } from "@/hooks/usePianoPlayer";
import { mergeOverlappingNotes } from "@/lib/noteProcessing";
import type { ProcessingState, SongData } from "@/lib/types";

const START_MIDI = 21;
const END_MIDI = 108;

export default function Home() {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: "idle",
  });

  // Apply pedal simulation: merge overlapping same-pitch notes
  const processedSongData = useMemo<SongData | undefined>(() => {
    if (!processingState.songData) return undefined;
    return {
      ...processingState.songData,
      notes: mergeOverlappingNotes(processingState.songData.notes),
    };
  }, [processingState.songData]);

  const player = usePianoPlayer(processedSongData);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Dynamic key width: fill viewport when wider than natural keyboard size
  const pianoContainerRef = useRef<HTMLDivElement | null>(null);
  const [keyWidth, setKeyWidth] = useState(28);

  useEffect(() => {
    const el = pianoContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const whiteKeys = getWhiteKeyCount(START_MIDI, END_MIDI);
      const naturalWidth = whiteKeys * 28;
      // Expand keys to fill if container is wider than natural size
      if (width >= naturalWidth) {
        setKeyWidth(width / whiteKeys);
      } else {
        setKeyWidth(28);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [processingState.status]);

  const handleSubmit = useCallback(async (url: string) => {
    setProcessingState({ status: "downloading" });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProcessingState({
          status: "error",
          error: data.error || "Failed to start analysis",
        });
        return;
      }

      setProcessingState((prev) => ({ ...prev, jobId: data.id }));
    } catch {
      setProcessingState({
        status: "error",
        error: "Failed to connect to server",
      });
    }
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setProcessingState({ status: "uploading" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setProcessingState({
          status: "error",
          error: data.error || "Failed to upload file",
        });
        return;
      }

      setProcessingState({ status: "transcribing", jobId: data.id });
    } catch {
      setProcessingState({
        status: "error",
        error: "Failed to upload file",
      });
    }
  }, []);

  // Poll for job status
  useEffect(() => {
    if (
      !processingState.jobId ||
      processingState.status === "complete" ||
      processingState.status === "error" ||
      processingState.status === "idle"
    ) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${processingState.jobId}`);
        const data = await res.json();

        if (data.status === "complete" && data.data) {
          setProcessingState({
            status: "complete",
            songData: data.data,
            jobId: processingState.jobId,
          });
        } else if (data.status === "error") {
          setProcessingState({
            status: "error",
            error: data.error || "Processing failed",
            jobId: processingState.jobId,
          });
        } else if (data.status === "transcribing") {
          setProcessingState((prev) => ({ ...prev, status: "transcribing" }));
        }
      } catch {
        // Ignore polling errors, will retry
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [processingState.jobId, processingState.status]);

  const handleReset = useCallback(() => {
    player.stop();
    setProcessingState({ status: "idle" });
  }, [player]);

  // Landing page
  if (processingState.status === "idle") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="mb-12 flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-purple-500/10 p-4">
            <Piano size={48} className="text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            finger<span className="text-purple-400">ragio</span>
          </h1>
          <p className="max-w-md text-center text-lg text-zinc-400">
            Paste a YouTube link or upload a MIDI file to learn any piano piece
            with interactive falling notes
          </p>
        </div>

        <SongInput onSubmit={handleSubmit} onFileUpload={handleFileUpload} />

        <div className="mt-8 flex flex-col items-center gap-2 text-sm text-zinc-600">
          <p>Supports YouTube videos and MIDI / MusicXML files</p>
          <p>No account needed - just paste and play</p>
        </div>
      </div>
    );
  }

  // Processing state
  if (
    processingState.status === "uploading" ||
    processingState.status === "downloading" ||
    processingState.status === "transcribing"
  ) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <ProcessingStatus status={processingState.status} />
        <button
          onClick={handleReset}
          className="mt-6 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Error state
  if (processingState.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <ProcessingStatus
          status="error"
          error={processingState.error}
        />
        <button
          onClick={handleReset}
          className="mt-6 flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          <ArrowLeft size={16} />
          Try another song
        </button>
      </div>
    );
  }

  // Player view — use processedSongData (with pedal-merged notes)
  const songData = processedSongData!;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex items-center gap-2">
          <Piano size={20} className="text-purple-400" />
          <span className="font-semibold text-white">
            finger<span className="text-purple-400">ragio</span>
          </span>
        </div>
        <div className="w-16" />
      </header>

      {/* Song info */}
      <div className="px-4 py-3">
        <SongInfo
          title={songData.title}
          duration={songData.duration}
          noteCount={songData.notes.length}
        />
      </div>

      {/* Sheet music */}
      <SheetMusic
        notes={songData.notes}
        currentTime={player.currentTime}
        isPlaying={player.isPlaying}
        duration={songData.duration}
        title={songData.title}
      />

      {/* Falling notes + Piano — shared horizontal scroll container */}
      <div className="flex flex-1 flex-col justify-end px-4 pb-4">
        <div
          ref={pianoContainerRef}
          className="overflow-hidden rounded-xl border border-zinc-800"
        >
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto"
          >
            <div className="flex flex-col">
              <FallingNotes
                notes={songData.notes}
                currentTime={player.currentTime}
                keyWidth={keyWidth}
              />
              <PianoKeyboard
                activeNotes={player.activeNotes}
                keyWidth={keyWidth}
              />
            </div>
          </div>
        </div>

        {/* Playback controls */}
        <div className="mt-4">
          <PlaybackControls
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            speed={player.speed}
            onPlay={player.play}
            onPause={player.pause}
            onStop={player.stop}
            onSpeedChange={player.setSpeed}
            onSeek={player.seek}
          />
        </div>
      </div>
    </div>
  );
}
