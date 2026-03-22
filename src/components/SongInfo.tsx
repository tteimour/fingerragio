"use client";

import { Music2, Clock, ListMusic } from "lucide-react";

interface SongInfoProps {
  title: string;
  duration: number;
  noteCount: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function SongInfo({ title, duration, noteCount }: SongInfoProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-zinc-900 px-4 py-3">
      <div className="flex items-center gap-2">
        <Music2 size={16} className="text-purple-400" />
        <span className="font-medium text-white">{title}</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-zinc-400">
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {formatDuration(duration)}
        </span>
        <span className="flex items-center gap-1">
          <ListMusic size={14} />
          {noteCount.toLocaleString()} notes
        </span>
      </div>
    </div>
  );
}
