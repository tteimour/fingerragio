import type { Note } from "./types";

// MIDI note number to ABC notation
const NOTE_NAMES = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];

function midiToAbc(midi: number): string {
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1; // MIDI octave (C4 = 60 → octave 4)
  const name = NOTE_NAMES[noteIndex];

  // ABC notation: C4 = "C", C5 = "c", C6 = "c'", C3 = "C,", C2 = "C,,"
  if (octave === 5) {
    return name.toLowerCase();
  } else if (octave > 5) {
    return name.toLowerCase() + "'".repeat(octave - 5);
  } else if (octave === 4) {
    return name;
  } else {
    return name + ",".repeat(4 - octave);
  }
}

// Quantize a duration in seconds to the nearest ABC duration value
function quantizeDuration(seconds: number, bpm: number): string {
  const beatsPerSecond = bpm / 60;
  // L:1/8 means default note length is an eighth note
  // So duration "1" = 1 eighth note = 0.5 beats
  const eighthNotes = seconds * beatsPerSecond * 2;

  // Snap to nearest musical value
  const quantized = Math.max(1, Math.round(eighthNotes));

  if (quantized === 1) return "";
  if (quantized === 2) return "2";
  if (quantized === 3) return "3";
  if (quantized === 4) return "4";
  if (quantized === 6) return "6";
  if (quantized === 8) return "8";
  return String(Math.min(quantized, 16));
}

// Estimate BPM from note onset intervals
export function estimateBpm(notes: Note[]): number {
  if (notes.length < 2) return 120;

  const onsets = [...new Set(notes.map((n) => n.startTime))].sort((a, b) => a - b);
  if (onsets.length < 2) return 120;

  // Collect intervals between consecutive onsets
  const intervals: number[] = [];
  for (let i = 1; i < Math.min(onsets.length, 200); i++) {
    const interval = onsets[i] - onsets[i - 1];
    if (interval > 0.05 && interval < 2.0) {
      intervals.push(interval);
    }
  }

  if (intervals.length === 0) return 120;

  // Median interval
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];

  // Convert to BPM (assume median interval ≈ one beat)
  const bpm = Math.round(60 / median);

  // Clamp to reasonable range
  return Math.max(40, Math.min(240, bpm));
}

// Group notes into time slots (chords share the same slot)
interface NoteSlot {
  time: number;
  notes: Note[];
}

function groupNotesIntoSlots(notes: Note[], toleranceMs: number = 30): NoteSlot[] {
  if (notes.length === 0) return [];

  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
  const slots: NoteSlot[] = [];
  let currentSlot: NoteSlot = { time: sorted[0].startTime, notes: [sorted[0]] };

  for (let i = 1; i < sorted.length; i++) {
    const note = sorted[i];
    if (Math.abs(note.startTime - currentSlot.time) < toleranceMs / 1000) {
      currentSlot.notes.push(note);
    } else {
      slots.push(currentSlot);
      currentSlot = { time: note.startTime, notes: [note] };
    }
  }
  slots.push(currentSlot);

  return slots;
}

// Main conversion: Note[] → ABC notation string
export function notesToAbc(
  notes: Note[],
  options?: { title?: string; bpm?: number }
): string {
  if (notes.length === 0) return "";

  const bpm = options?.bpm ?? estimateBpm(notes);
  const title = options?.title ?? "Transcription";
  const slots = groupNotesIntoSlots(notes);

  // Build header
  const lines: string[] = [
    "X:1",
    `T:${title}`,
    "M:4/4",
    "L:1/8",
    `Q:1/4=${bpm}`,
    "K:C",
  ];

  // Build body
  let body = "";
  let eighthsInBar = 0;
  const eighthsPerBar = 8; // 4/4 time with L:1/8

  let prevEndTime = 0;

  for (const slot of slots) {
    // Insert rest if there's a gap
    const gap = slot.time - prevEndTime;
    if (gap > 0.05) {
      const restDur = quantizeDuration(gap, bpm);
      const restEighths = restDur === "" ? 1 : parseInt(restDur) || 1;
      body += `z${restDur} `;
      eighthsInBar += restEighths;
    }

    // Get the longest duration in this slot for the chord duration
    const maxDuration = Math.max(...slot.notes.map((n) => n.duration));
    const dur = quantizeDuration(maxDuration, bpm);
    const durEighths = dur === "" ? 1 : parseInt(dur) || 1;

    if (slot.notes.length === 1) {
      body += `${midiToAbc(slot.notes[0].midi)}${dur} `;
    } else {
      // Chord: [CEG]
      const chordNotes = slot.notes
        .sort((a, b) => a.midi - b.midi)
        .map((n) => midiToAbc(n.midi))
        .join("");
      body += `[${chordNotes}]${dur} `;
    }

    eighthsInBar += durEighths;
    prevEndTime = slot.time + maxDuration;

    // Add barline
    if (eighthsInBar >= eighthsPerBar) {
      body += "| ";
      eighthsInBar = eighthsInBar % eighthsPerBar;
    }
  }

  // Final barline
  if (!body.trimEnd().endsWith("|")) {
    body += "|]";
  }

  lines.push(body.trim());
  return lines.join("\n");
}
