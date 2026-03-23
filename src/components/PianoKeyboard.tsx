"use client";

import { useCallback } from "react";
import { generateKeys, isBlackKey, midiToNoteName, initAudio, playNote } from "@/lib/piano";

const DEFAULT_KEY_WIDTH = 28;

interface PianoKeyboardProps {
  activeNotes: Set<number>;
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
  startMidi = 21,
  endMidi = 108,
  keyWidth = DEFAULT_KEY_WIDTH,
}: PianoKeyboardProps) {
  const allKeys = generateKeys(startMidi, endMidi);
  const whiteKeys = allKeys.filter((k) => !isBlackKey(k));
  const blackKeys = allKeys.filter((k) => isBlackKey(k));
  const totalWidth = whiteKeys.length * keyWidth;

  const handleKeyClick = useCallback(async (midi: number) => {
    await initAudio();
    playNote(midi, 0.5, 0.8);
  }, []);

  return (
    <div
      className="relative select-none"
      style={{
        width: `${totalWidth}px`,
        height: "170px",
        flexShrink: 0,
        background: "linear-gradient(180deg, #1a1a1f 0%, #0f0f12 100%)",
      }}
    >
      {/* White keys */}
      {whiteKeys.map((midi, i) => {
        const active = activeNotes.has(midi);
        return (
          <button
            key={midi}
            onMouseDown={() => handleKeyClick(midi)}
            className="absolute top-0"
            style={{
              left: `${i * keyWidth}px`,
              width: `${keyWidth}px`,
              height: "100%",
              borderRadius: "0 0 5px 5px",
              zIndex: 1,
              border: "none",
              cursor: "pointer",
              transition: "transform 50ms ease, box-shadow 50ms ease, height 50ms ease",
              transformOrigin: "top center",
              transform: active ? "scaleY(0.97)" : "scaleY(1)",
              background: active
                ? "linear-gradient(180deg, #c084fc 0%, #a855f7 40%, #9333ea 80%, #7e22ce 100%)"
                : "linear-gradient(180deg, #fafafa 0%, #f0f0f0 40%, #e8e8e8 75%, #d4d4d8 100%)",
              boxShadow: active
                ? `0 0 24px rgba(168, 85, 247, 0.7), 0 0 48px rgba(168, 85, 247, 0.3), inset 0 -1px 2px rgba(147, 51, 234, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)`
                : `inset -1px 0 0 rgba(0,0,0,0.08), inset 1px 0 0 rgba(0,0,0,0.08), 0 4px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3), inset 0 -4px 6px rgba(0,0,0,0.06)`,
            }}
            title={midiToNoteName(midi)}
          >
            {/* White key top highlight */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "1px",
                right: "1px",
                height: "3px",
                borderRadius: "0 0 2px 2px",
                background: active
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(255,255,255,0.9)",
                pointerEvents: "none",
              }}
            />
            {midi % 12 === 0 && (
              <span
                className="absolute bottom-2 left-1/2 -translate-x-1/2"
                style={{
                  fontSize: "10px",
                  color: active ? "rgba(255,255,255,0.8)" : "rgba(140,140,160,0.6)",
                  fontWeight: 500,
                }}
              >
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
            className="absolute top-0"
            style={{
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              height: "62%",
              borderRadius: "0 0 4px 4px",
              zIndex: 2,
              border: "none",
              cursor: "pointer",
              transition: "transform 50ms ease, box-shadow 50ms ease",
              transformOrigin: "top center",
              transform: active ? "scaleY(0.94)" : "scaleY(1)",
              background: active
                ? "linear-gradient(180deg, #a855f7 0%, #7c3aed 40%, #6d28d9 80%, #5b21b6 100%)"
                : "linear-gradient(180deg, #2a2a30 0%, #1e1e22 30%, #141418 70%, #0c0c0f 100%)",
              boxShadow: active
                ? `0 0 22px rgba(168, 85, 247, 0.8), 0 0 44px rgba(168, 85, 247, 0.3), inset 0 -1px 2px rgba(109, 40, 217, 0.6), inset 0 1px 0 rgba(255,255,255,0.1)`
                : `0 4px 6px rgba(0,0,0,0.7), 0 2px 3px rgba(0,0,0,0.5), inset 0 -4px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
            title={midiToNoteName(midi)}
          >
            {/* Black key top bevel highlight */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "40%",
                borderRadius: "0 0 2px 2px",
                background: active
                  ? "linear-gradient(180deg, rgba(168,85,247,0.3) 0%, transparent 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                pointerEvents: "none",
              }}
            />
          </button>
        );
      })}

      {/* Bottom shadow for depth */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 w-full"
        style={{
          height: "8px",
          background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)",
          zIndex: 3,
        }}
      />
    </div>
  );
}
