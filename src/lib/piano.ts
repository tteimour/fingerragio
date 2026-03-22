import * as Tone from "tone";

let piano: Tone.Sampler | null = null;
let initialized = false;
let loadPromise: Promise<void> | null = null;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function isBlackKey(midi: number): boolean {
  const note = midi % 12;
  return [1, 3, 6, 8, 10].includes(note);
}

export function getKeyColor(midi: number): "white" | "black" {
  return isBlackKey(midi) ? "black" : "white";
}

// Generate keys for a range (default: full 88 keys A0=21 to C8=108)
export function generateKeys(startMidi: number = 21, endMidi: number = 108): number[] {
  const keys: number[] = [];
  for (let i = startMidi; i <= endMidi; i++) {
    keys.push(i);
  }
  return keys;
}

// Salamander Grand Piano samples (freely hosted)
const SAMPLE_BASE_URL = "https://tonejs.github.io/audio/salamander/";

// Sample every 3rd note across the full range for good coverage with reasonable load time
function buildSampleMap(): Record<string, string> {
  const samples: Record<string, string> = {};
  const sampledNotes = [
    "A0", "C1", "D#1", "F#1", "A1",
    "C2", "D#2", "F#2", "A2",
    "C3", "D#3", "F#3", "A3",
    "C4", "D#4", "F#4", "A4",
    "C5", "D#5", "F#5", "A5",
    "C6", "D#6", "F#6", "A6",
    "C7", "D#7", "F#7", "A7",
    "C8",
  ];
  for (const note of sampledNotes) {
    // Salamander files use "s" for sharp, e.g. Ds1.mp3
    const fileName = note.replace("#", "s");
    samples[note] = `${fileName}.mp3`;
  }
  return samples;
}

export async function initAudio(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;

  await Tone.start();

  loadPromise = new Promise<void>((resolve) => {
    piano = new Tone.Sampler({
      urls: buildSampleMap(),
      baseUrl: SAMPLE_BASE_URL,
      release: 1.2,
      onload: () => {
        initialized = true;
        resolve();
      },
      onerror: () => {
        loadPromise = null;
        resolve();
      },
    }).toDestination();
    piano.volume.value = -4;
  });

  return loadPromise;
}

// Interactive key click — immediate playback
export function playNote(midi: number, duration: number = 0.3, velocity: number = 0.8): void {
  if (!initialized || !piano) return;
  const noteName = midiToNoteName(midi);
  piano.triggerAttackRelease(noteName, Math.max(duration, 0.05), Tone.now(), velocity);
}

// Schedule a note on the Tone.Transport timeline (for playback sync)
export function scheduleNote(
  midi: number,
  time: number,
  duration: number,
  velocity: number
): void {
  if (!initialized || !piano) return;
  const noteName = midiToNoteName(midi);
  const p = piano;
  Tone.getTransport().schedule((t) => {
    p.triggerAttackRelease(noteName, Math.max(duration, 0.05), t, velocity);
  }, time);
}

export function playNoteOn(midi: number, velocity: number = 0.8): void {
  if (!initialized || !piano) return;
  const noteName = midiToNoteName(midi);
  piano.triggerAttack(noteName, Tone.now(), velocity);
}

export function playNoteOff(midi: number): void {
  if (!initialized || !piano) return;
  const noteName = midiToNoteName(midi);
  piano.triggerRelease(noteName, Tone.now());
}

export function stopAllNotes(): void {
  if (piano) {
    piano.releaseAll();
  }
}

export function isAudioReady(): boolean {
  return initialized;
}
