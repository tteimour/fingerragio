"use client";

import { useCallback, useEffect, useRef } from "react";
import { generateKeys, isBlackKey, midiToNoteName, initAudio, playNote } from "@/lib/piano";

const DEFAULT_KEY_WIDTH = 28;

interface PianoKeyboardProps {
  activeNotes: Set<number>;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  startMidi?: number;
  endMidi?: number;
  keyWidth?: number;
}

// Black key offsets within each white key slot
function getBlackKeyOffset(midi: number): number {
  const noteInOctave = midi % 12;
  switch (noteInOctave) {
    case 1: return 0.6;   // C#
    case 3: return 0.65;  // D#
    case 6: return 0.55;  // F#
    case 8: return 0.6;   // G#
    case 10: return 0.65; // A#
    default: return 0.6;
  }
}

export function getWhiteKeyCount(startMidi: number, endMidi: number): number {
  let count = 0;
  for (let i = startMidi; i <= endMidi; i++) {
    if (!isBlackKey(i)) count++;
  }
  return count;
}

export function getTotalWidth(startMidi: number, endMidi: number, kw: number = DEFAULT_KEY_WIDTH): number {
  return getWhiteKeyCount(startMidi, endMidi) * kw;
}

// Get x position in pixels for a given midi note
export function getNoteX(midi: number, startMidi: number, kw: number = DEFAULT_KEY_WIDTH): { left: number; width: number } {
  // Count white keys before this note
  const whiteKeys: number[] = [];
  for (let i = startMidi; i <= midi; i++) {
    if (!isBlackKey(i)) whiteKeys.push(i);
  }

  if (isBlackKey(midi)) {
    const whiteIndex = whiteKeys.length - 1;
    const offset = getBlackKeyOffset(midi);
    const blackWidth = kw * 0.6;
    return {
      left: (whiteIndex + offset) * kw - blackWidth / 2,
      width: blackWidth,
    };
  } else {
    const whiteIndex = whiteKeys.length - 1;
    return {
      left: whiteIndex * kw,
      width: kw,
    };
  }
}

export default function PianoKeyboard({
  activeNotes,
  scrollContainerRef,
  startMidi = 21,
  endMidi = 108,
  keyWidth = DEFAULT_KEY_WIDTH,
}: PianoKeyboardProps) {
  const allKeys = generateKeys(startMidi, endMidi);
  const whiteKeys = allKeys.filter((k) => !isBlackKey(k));
  const blackKeys = allKeys.filter((k) => isBlackKey(k));
  const totalWidth = whiteKeys.length * keyWidth;
  const lastScrollRef = useRef(0);

  const handleKeyClick = useCallback(async (midi: number) => {
    await initAudio();
    playNote(midi, 0.5, 0.8);
  }, []);

  // Auto-scroll to center on active notes
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container || activeNotes.size === 0) return;

    const activeArr = Array.from(activeNotes);
    let minX = Infinity;
    let maxX = -Infinity;
    for (const midi of activeArr) {
      if (midi < startMidi || midi > endMidi) continue;
      const pos = getNoteX(midi, startMidi, keyWidth);
      minX = Math.min(minX, pos.left);
      maxX = Math.max(maxX, pos.left + pos.width);
    }
    if (minX === Infinity) return;

    const centerX = (minX + maxX) / 2;
    const targetScroll = centerX - container.clientWidth / 2;

    if (Math.abs(targetScroll - lastScrollRef.current) > 40) {
      container.scrollTo({ left: targetScroll, behavior: "smooth" });
      lastScrollRef.current = targetScroll;
    }
  }, [activeNotes, scrollContainerRef, startMidi, endMidi, keyWidth]);

  return (
    <div className="relative select-none" style={{ width: `${totalWidth}px`, height: "160px", flexShrink: 0 }}>
      {/* White keys */}
      {whiteKeys.map((midi, i) => {
        const active = activeNotes.has(midi);
        return (
          <button
            key={midi}
            onMouseDown={() => handleKeyClick(midi)}
            className={`absolute top-0 h-full border-r transition-colors duration-75 ${
              active
                ? "border-purple-500/50"
                : "border-zinc-700 hover:bg-zinc-200 active:bg-purple-300"
            }`}
            style={{
              left: `${i * keyWidth}px`,
              width: `${keyWidth}px`,
              borderRadius: "0 0 4px 4px",
              zIndex: 1,
              background: active
                ? "linear-gradient(180deg, #c084fc 0%, #a855f7 60%, #9333ea 100%)"
                : "#f4f4f5",
              boxShadow: active
                ? "0 0 16px rgba(168, 85, 247, 0.5), inset 0 -4px 8px rgba(147, 51, 234, 0.3)"
                : "none",
            }}
            title={midiToNoteName(midi)}
          >
            {midi % 12 === 0 && (
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-zinc-400">
                {midiToNoteName(midi)}
              </span>
            )}
          </button>
        );
      })}

      {/* Black keys */}
      {blackKeys.map((midi) => {
        const active = activeNotes.has(midi);
        const pos = getNoteX(midi, startMidi, keyWidth);
        return (
          <button
            key={midi}
            onMouseDown={() => handleKeyClick(midi)}
            className={`absolute top-0 transition-colors duration-75 ${
              active
                ? ""
                : "hover:bg-zinc-800 active:bg-purple-600"
            }`}
            style={{
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              height: "60%",
              borderRadius: "0 0 3px 3px",
              zIndex: 2,
              background: active
                ? "linear-gradient(180deg, #a855f7 0%, #7c3aed 60%, #6d28d9 100%)"
                : "#18181b",
              boxShadow: active
                ? "0 0 16px rgba(168, 85, 247, 0.6), inset 0 -2px 4px rgba(109, 40, 217, 0.4)"
                : "inset 0 -2px 4px rgba(0, 0, 0, 0.4)",
            }}
            title={midiToNoteName(midi)}
          />
        );
      })}
    </div>
  );
}
