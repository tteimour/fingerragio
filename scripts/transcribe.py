#!/usr/bin/env python3
"""
Download YouTube audio and transcribe to piano notes, or parse uploaded files.

Usage:
  python transcribe.py youtube <youtube_url> <output_dir> <job_id>
  python transcribe.py file <file_path> <output_dir> <job_id>
"""

import sys
import os
import json
import tempfile
import subprocess
from pathlib import Path


def update_status(output_dir: str, job_id: str, status: str, data=None, error=None):
    """Write status file for the polling endpoint."""
    status_file = Path(output_dir) / f"{job_id}.json"
    payload = {"status": status}
    if data:
        payload["data"] = data
    if error:
        payload["error"] = error
    status_file.write_text(json.dumps(payload))


def download_audio_pytubefix(url: str, output_path: str) -> tuple[str, str]:
    """Download audio from YouTube using pytubefix. Returns (wav_path, title)."""
    from pytubefix import YouTube

    yt = YouTube(url)
    title = yt.title or "Unknown Song"
    stream = yt.streams.filter(only_audio=True).order_by("abr").desc().first()
    if not stream:
        raise RuntimeError("No audio streams found")

    raw_path = stream.download(output_path=output_path, filename="audio_raw")
    wav_path = os.path.join(output_path, "audio.wav")
    cmd = ["ffmpeg", "-y", "-i", raw_path, "-ar", "44100", "-ac", "1", wav_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")
    return wav_path, title


def download_audio_ytdlp(url: str, output_path: str) -> tuple[str, str]:
    """Download audio from YouTube using yt-dlp. Returns (wav_path, title)."""
    # Get title
    title = "Unknown Song"
    try:
        cmd = ["yt-dlp", "--get-title", "--no-playlist", url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            title = result.stdout.strip()
    except Exception:
        pass

    # Download audio
    output_template = os.path.join(output_path, "audio.%(ext)s")
    cmd = [
        "yt-dlp", "-x", "--audio-format", "wav", "--audio-quality", "0",
        "-o", output_template, "--no-playlist", "--max-downloads", "1",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    for f in os.listdir(output_path):
        if f.endswith(".wav"):
            return os.path.join(output_path, f), title
    raise RuntimeError(f"yt-dlp failed: {(result.stderr or result.stdout or '').strip()}")


def transcribe_audio(wav_path: str):
    """Transcribe audio to piano notes using Spotify's basic-pitch."""
    from basic_pitch.inference import predict
    import basic_pitch

    # Use ONNX model explicitly — the bundled TFLite model can be broken
    onnx_model = Path(basic_pitch.__file__).parent / "saved_models" / "icassp_2022" / "nmp.onnx"

    _, _, note_events = predict(wav_path, model_or_model_path=onnx_model)
    # note_events: list of (start_time, end_time, pitch_midi, amplitude, pitch_bend)
    # amplitude is already 0.0-1.0 (NOT 0-127 MIDI velocity)

    notes = []
    for start, end, pitch, amplitude, _ in note_events:
        pitch = int(pitch)
        if 21 <= pitch <= 108:
            notes.append({
                "midi": pitch,
                "startTime": round(float(start), 4),
                "duration": round(float(end - start), 4),
                "velocity": round(float(min(amplitude, 1.0)), 4),
            })

    notes.sort(key=lambda n: (n["startTime"], n["midi"]))
    return notes


def parse_midi_file(midi_path: str):
    """Parse a MIDI file into note events using pretty_midi."""
    import pretty_midi

    midi = pretty_midi.PrettyMIDI(midi_path)
    notes = []

    for instrument in midi.instruments:
        if instrument.is_drum:
            continue
        for note in instrument.notes:
            if 21 <= note.pitch <= 108:
                notes.append({
                    "midi": int(note.pitch),
                    "startTime": round(float(note.start), 4),
                    "duration": round(float(note.end - note.start), 4),
                    "velocity": round(float(note.velocity) / 127.0, 4),
                })

    notes.sort(key=lambda n: (n["startTime"], n["midi"]))
    return notes


def parse_musicxml_file(xml_path: str):
    """Parse a MusicXML file into note events using music21."""
    from music21 import converter, note as m21note, chord as m21chord

    score = converter.parse(xml_path)
    notes = []

    for element in score.recurse():
        if isinstance(element, m21note.Note):
            if element.pitch.midi is not None and 21 <= element.pitch.midi <= 108:
                start = float(element.offset)
                dur = float(element.quarterLength)
                # Convert quarter-note beats to seconds (assume 120 BPM default)
                tempo = 120.0
                tempos = list(score.recurse().getElementsByClass('MetronomeMark'))
                if tempos:
                    tempo = tempos[0].number
                seconds_per_beat = 60.0 / tempo
                notes.append({
                    "midi": int(element.pitch.midi),
                    "startTime": round(start * seconds_per_beat, 4),
                    "duration": round(max(dur * seconds_per_beat, 0.05), 4),
                    "velocity": round(float(element.volume.velocity or 80) / 127.0, 4),
                })
        elif isinstance(element, m21chord.Chord):
            start = float(element.offset)
            dur = float(element.quarterLength)
            tempo = 120.0
            tempos = list(score.recurse().getElementsByClass('MetronomeMark'))
            if tempos:
                tempo = tempos[0].number
            seconds_per_beat = 60.0 / tempo
            for pitch in element.pitches:
                if pitch.midi is not None and 21 <= pitch.midi <= 108:
                    notes.append({
                        "midi": int(pitch.midi),
                        "startTime": round(start * seconds_per_beat, 4),
                        "duration": round(max(dur * seconds_per_beat, 0.05), 4),
                        "velocity": round(float(element.volume.velocity or 80) / 127.0, 4),
                    })

    notes.sort(key=lambda n: (n["startTime"], n["midi"]))
    return notes


def handle_youtube(url: str, output_dir: str, job_id: str):
    """Handle YouTube URL transcription."""
    update_status(output_dir, job_id, "downloading")

    with tempfile.TemporaryDirectory() as tmp_dir:
        # Try pytubefix first (works on cloud servers), fall back to yt-dlp
        try:
            wav_path, title = download_audio_pytubefix(url, tmp_dir)
        except Exception as pytube_err:
            print(f"pytubefix failed ({pytube_err}), falling back to yt-dlp...")
            wav_path, title = download_audio_ytdlp(url, tmp_dir)

        update_status(output_dir, job_id, "transcribing")
        notes = transcribe_audio(wav_path)

    if not notes:
        update_status(output_dir, job_id, "error", error="No piano notes detected in this audio")
        return

    duration = max(n["startTime"] + n["duration"] for n in notes)
    song_data = {
        "id": job_id,
        "title": title,
        "notes": notes,
        "duration": round(duration, 4),
    }
    update_status(output_dir, job_id, "complete", data=song_data)


def handle_file(file_path: str, output_dir: str, job_id: str):
    """Handle uploaded file parsing."""
    update_status(output_dir, job_id, "transcribing")

    ext = Path(file_path).suffix.lower()

    if ext in (".mid", ".midi"):
        notes = parse_midi_file(file_path)
        title = Path(file_path).stem
    elif ext in (".xml", ".mxl", ".musicxml"):
        notes = parse_musicxml_file(file_path)
        title = Path(file_path).stem
    elif ext == ".wav":
        # Audio file — run through transcription
        notes = transcribe_audio(file_path)
        title = Path(file_path).stem
    else:
        update_status(output_dir, job_id, "error", error=f"Unsupported file type: {ext}")
        return

    if not notes:
        update_status(output_dir, job_id, "error", error="No piano notes detected in this file")
        return

    duration = max(n["startTime"] + n["duration"] for n in notes)
    song_data = {
        "id": job_id,
        "title": title,
        "notes": notes,
        "duration": round(duration, 4),
    }
    update_status(output_dir, job_id, "complete", data=song_data)


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python transcribe.py youtube <youtube_url> <output_dir> <job_id>")
        print("  python transcribe.py file <file_path> <output_dir> <job_id>")
        sys.exit(1)

    mode = sys.argv[1]

    if mode == "youtube":
        if len(sys.argv) != 5:
            print("Usage: python transcribe.py youtube <youtube_url> <output_dir> <job_id>")
            sys.exit(1)
        url, output_dir, job_id = sys.argv[2], sys.argv[3], sys.argv[4]
        os.makedirs(output_dir, exist_ok=True)
        try:
            handle_youtube(url, output_dir, job_id)
        except Exception as e:
            update_status(output_dir, job_id, "error", error=str(e))
            sys.exit(1)

    elif mode == "file":
        if len(sys.argv) != 5:
            print("Usage: python transcribe.py file <file_path> <output_dir> <job_id>")
            sys.exit(1)
        file_path, output_dir, job_id = sys.argv[2], sys.argv[3], sys.argv[4]
        os.makedirs(output_dir, exist_ok=True)
        try:
            handle_file(file_path, output_dir, job_id)
        except Exception as e:
            update_status(output_dir, job_id, "error", error=str(e))
            sys.exit(1)

    else:
        print(f"Unknown mode: {mode}")
        print("Use 'youtube' or 'file'")
        sys.exit(1)


if __name__ == "__main__":
    main()
