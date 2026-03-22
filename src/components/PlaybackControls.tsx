"use client";

import { Play, Pause, Square, SkipBack } from "lucide-react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (time: number) => void;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  speed,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onSeek,
}: PlaybackControlsProps) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-lg bg-zinc-900 p-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400 tabular-nums w-10">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-purple-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
        />
        <span className="text-xs text-zinc-400 tabular-nums w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onStop}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            title="Stop"
          >
            <Square size={18} />
          </button>

          <button
            onClick={() => onSeek(0)}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            title="Restart"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            className="rounded-full bg-purple-600 p-3 text-white transition-colors hover:bg-purple-700"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs text-zinc-500">Speed:</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                speed === s
                  ? "bg-purple-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
