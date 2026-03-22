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
import re
from pathlib import Path

import requests


def update_status(output_dir: str, job_id: str, status: str, data=None, error=None):
    """Write status file for the polling endpoint."""
    status_file = Path(output_dir) / f"{job_id}.json"
    payload = {"status": status}
    if data:
        payload["data"] = data
    if error:
        payload["error"] = error
    status_file.write_text(json.dumps(payload))


PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://watchapi.whatever.social",
    "https://api.piped.yt",
]


def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:shorts/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"Could not extract video ID from: {url}")


def fetch_piped_streams(video_id: str) -> dict:
    """Fetch stream data from Piped API, trying multiple instances."""
    errors = []
    for instance in PIPED_INSTANCES:
        try:
            resp = requests.get(f"{instance}/streams/{video_id}", timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if "audioStreams" in data and data["audioStreams"]:
                    return data
                errors.append(f"{instance}: no audio streams in response")
            else:
                errors.append(f"{instance}: HTTP {resp.status_code}")
        except requests.RequestException as e:
            errors.append(f"{instance}: {e}")
    raise RuntimeError(f"All Piped instances failed: {'; '.join(errors)}")


def download_audio(url: str, output_path: str) -> str:
    """Download audio from YouTube via Piped API, with yt-dlp fallback."""
    video_id = extract_video_id(url)
    wav_path = os.path.join(output_path, "audio.wav")

    try:
        data = fetch_piped_streams(video_id)
        # Pick the highest-bitrate audio stream
        streams = sorted(data["audioStreams"], key=lambda s: s.get("bitrate", 0), reverse=True)
        audio_url = streams[0]["url"]

        # Download audio stream
        raw_path = os.path.join(output_path, "audio_raw")
        with requests.get(audio_url, stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(raw_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        # Convert to WAV with ffmpeg
        cmd = ["ffmpeg", "-y", "-i", raw_path, "-ar", "44100", "-ac", "1", wav_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr}")

        return wav_path
    except Exception as piped_err:
        # Fallback to yt-dlp (works on local dev where YouTube doesn't block)
        print(f"Piped API failed ({piped_err}), falling back to yt-dlp...")
        output_template = os.path.join(output_path, "audio.%(ext)s")
        cmd = [
            "yt-dlp", "-x", "--audio-format", "wav", "--audio-quality", "0",
            "-o", output_template, "--no-playlist", "--max-downloads", "1",
            url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        for f in os.listdir(output_path):
            if f.endswith(".wav"):
                return os.path.join(output_path, f)
        raise RuntimeError(f"Piped failed: {piped_err}; yt-dlp also failed: {(result.stderr or result.stdout or '').strip()}")


def get_video_title(url: str) -> str:
    """Get the video title from Piped API, with yt-dlp fallback."""
    try:
        video_id = extract_video_id(url)
        data = fetch_piped_streams(video_id)
        title = data.get("title", "").strip()
        if title:
            return title
    except Exception:
        pass
    # Fallback to yt-dlp
    try:
        cmd = ["yt-dlp", "--get-title", "--no-playlist", url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return "Unknown Song"


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


def download_audio_from_piped(piped_data: dict, output_path: str) -> str:
    """Download audio using pre-fetched Piped stream data, convert to WAV."""
    wav_path = os.path.join(output_path, "audio.wav")
    streams = sorted(piped_data["audioStreams"], key=lambda s: s.get("bitrate", 0), reverse=True)
    audio_url = streams[0]["url"]

    raw_path = os.path.join(output_path, "audio_raw")
    with requests.get(audio_url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(raw_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    cmd = ["ffmpeg", "-y", "-i", raw_path, "-ar", "44100", "-ac", "1", wav_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")
    return wav_path


def handle_youtube(url: str, output_dir: str, job_id: str):
    """Handle YouTube URL transcription."""
    update_status(output_dir, job_id, "downloading")

    video_id = extract_video_id(url)
    title = "Unknown Song"

    with tempfile.TemporaryDirectory() as tmp_dir:
        # Try Piped API first (works on cloud servers)
        try:
            piped_data = fetch_piped_streams(video_id)
            title = piped_data.get("title", "").strip() or title
            wav_path = download_audio_from_piped(piped_data, tmp_dir)
        except Exception as piped_err:
            # Fallback to yt-dlp (works on local dev)
            print(f"Piped API failed ({piped_err}), falling back to yt-dlp...")
            wav_path = download_audio(url, tmp_dir)
            if title == "Unknown Song":
                title = get_video_title(url)

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
