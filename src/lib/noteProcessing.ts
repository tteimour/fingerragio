import type { Note } from "./types";

/**
 * Simulates sustain pedal by merging overlapping or nearly-adjacent notes
 * of the same pitch. basic-pitch often splits pedal-sustained notes into
 * multiple short re-attacks when sustain pedal is held.
 *
 * @param notes - Raw transcribed notes
 * @param gapThreshold - Maximum gap (seconds) between same-pitch notes to merge (default 80ms)
 * @returns Merged notes with sustained durations
 */
export function mergeOverlappingNotes(notes: Note[], gapThreshold: number = 0.08): Note[] {
  if (notes.length === 0) return notes;

  // Group notes by MIDI pitch
  const byPitch = new Map<number, Note[]>();
  for (const note of notes) {
    const group = byPitch.get(note.midi) || [];
    group.push(note);
    byPitch.set(note.midi, group);
  }

  const merged: Note[] = [];

  for (const [, group] of byPitch) {
    // Sort by start time
    group.sort((a, b) => a.startTime - b.startTime);

    let current = { ...group[0] };

    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      const currentEnd = current.startTime + current.duration;

      // Merge if next note starts within gapThreshold of current note ending
      // or overlaps with it
      if (next.startTime <= currentEnd + gapThreshold) {
        const newEnd = Math.max(currentEnd, next.startTime + next.duration);
        current.duration = newEnd - current.startTime;
        current.velocity = Math.max(current.velocity, next.velocity);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }

  // Sort by start time, then by pitch for stable ordering
  merged.sort((a, b) => a.startTime - b.startTime || a.midi - b.midi);
  return merged;
}
