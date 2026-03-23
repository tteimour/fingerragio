"use client";

import { useMemo } from "react";
import type { Note } from "@/lib/types";
import { isBlackKey } from "@/lib/piano";
import { getNoteX, getTotalWidth } from "@/components/PianoKeyboard";

interface FallingNotesProps {
  notes: Note[];
  currentTime: number;
  startMidi?: number;
  endMidi?: number;
  windowSeconds?: number;
  keyWidth?: number;
}

export default function FallingNotes({
  notes,
  currentTime,
  startMidi = 21,
  endMidi = 108,
  windowSeconds = 4,
  keyWidth = 28,
}: FallingNotesProps) {
  const totalWidth = getTotalWidth(startMidi, endMidi, keyWidth);

  // Filter notes visible in the current window
  const visibleNotes = useMemo(() => {
    return notes.filter((note) => {
      const noteEnd = note.startTime + note.duration;
      const windowStart = currentTime;
      const windowEnd = currentTime + windowSeconds;
      return noteEnd > windowStart && note.startTime < windowEnd;
    });
  }, [notes, currentTime, windowSeconds]);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: `${totalWidth}px`,
        height: "300px",
        flexShrink: 0,
        background: "linear-gradient(180deg, rgba(9,9,11,0.95) 0%, rgba(9,9,11,0.8) 80%, rgba(88,28,135,0.08) 100%)",
      }}
    >
      {/* Subtle grid lines */}
      {(() => {
        const lines: React.ReactNode[] = [];
        let whiteIdx = 0;
        for (let i = startMidi; i <= endMidi; i++) {
          if (!isBlackKey(i)) {
            whiteIdx++;
            lines.push(
              <div
                key={i}
                className="absolute top-0 h-full"
                style={{
                  left: `${whiteIdx * keyWidth}px`,
                  width: "1px",
                  background: "rgba(63, 63, 70, 0.25)",
                }}
              />
            );
          }
        }
        return lines;
      })()}

      {/* Falling notes */}
      {visibleNotes.map((note, idx) => {
        const { left, width } = getNoteX(note.midi, startMidi, keyWidth);
        const heightPercent = (Math.max(note.duration, 0.08) / windowSeconds) * 100;
        const topPercent = 100 - ((note.startTime + note.duration - currentTime) / windowSeconds) * 100;

        // Is this note currently playing?
        const isActive = currentTime >= note.startTime && currentTime < note.startTime + note.duration;
        const isBlack = isBlackKey(note.midi);

        // Velocity-based intensity
        const vel = note.velocity;
        const baseAlpha = 0.55 + vel * 0.45;

        return (
          <div
            key={`${note.midi}-${note.startTime}-${idx}`}
            className="absolute"
            style={{
              left: `${left}px`,
              width: `${width}px`,
              top: `${topPercent}%`,
              height: `${heightPercent}%`,
              minHeight: "6px",
              borderRadius: "5px",
              zIndex: isBlack ? 2 : 1,
              background: isBlack
                ? `linear-gradient(180deg, rgba(139, 92, 246, ${baseAlpha * 0.7}) 0%, rgba(168, 85, 247, ${baseAlpha}) 50%, rgba(147, 51, 234, ${baseAlpha * 0.9}) 100%)`
                : `linear-gradient(180deg, rgba(192, 132, 252, ${baseAlpha * 0.7}) 0%, rgba(168, 85, 247, ${baseAlpha}) 50%, rgba(147, 51, 234, ${baseAlpha * 0.85}) 100%)`,
              boxShadow: isActive
                ? `0 0 14px rgba(168, 85, 247, 0.6), 0 0 28px rgba(168, 85, 247, 0.25), inset 0 0 8px rgba(255, 255, 255, 0.1)`
                : `0 1px 4px rgba(0, 0, 0, 0.3)`,
              border: isActive
                ? "1px solid rgba(192, 132, 252, 0.5)"
                : "1px solid rgba(168, 85, 247, 0.15)",
            }}
          />
        );
      })}

      {/* Bottom glow reflection */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 w-full"
        style={{
          height: "60px",
          background: "linear-gradient(to top, rgba(147, 51, 234, 0.12), transparent)",
          zIndex: 5,
        }}
      />

      {/* "Now" line */}
      <div
        className="absolute bottom-0 left-0 w-full"
        style={{
          height: "3px",
          background: "linear-gradient(90deg, rgba(168, 85, 247, 0.3), rgba(192, 132, 252, 1), rgba(168, 85, 247, 0.3))",
          boxShadow: "0 0 12px rgba(168, 85, 247, 0.6), 0 -4px 16px rgba(168, 85, 247, 0.2)",
          zIndex: 10,
        }}
      />
    </div>
  );
}
