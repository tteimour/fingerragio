# Fingerragio - Piano Learning Website

## Project Overview
Piano learning website where users paste a YouTube link or upload a MIDI/MusicXML file, and the app transcribes it to piano notes displayed on an interactive 88-key keyboard with falling notes visualization (Synthesia-style).

## Tech Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS v4 (dark theme)
- **Backend**: Next.js API routes + Python scripts (spawned via child_process)
- **Audio Pipeline**: Piped API (yt-dlp fallback) → ffmpeg → basic-pitch (Spotify) → note events → JSON
- **File Parsing**: pretty_midi (MIDI files), music21 (MusicXML files)
- **Piano Sound**: Tone.js Sampler with Salamander Grand Piano samples (CDN-hosted)
- **Sheet Music**: abcjs (ABC notation renderer, dynamically imported)
- **Icons**: lucide-react

## Commands
- `npm run dev` - Start development server (port 3000)
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `pip install -r requirements.txt` - Install Python dependencies
- `bash scripts/deploy.sh` - Deploy to Cloudflare Pages (fingerragio.innovariance.com)

## Architecture
- `/scripts/transcribe.py` - Python script with two modes:
  - `python transcribe.py youtube <url> <output_dir> <job_id>` — download + transcribe YouTube audio
  - `python transcribe.py file <file_path> <output_dir> <job_id>` — parse uploaded MIDI/MusicXML
- `/src/app/api/analyze/route.ts` - POST endpoint to start YouTube transcription
- `/src/app/api/upload/route.ts` - POST endpoint for file uploads (multipart form data)
- `/src/app/api/status/[id]/route.ts` - GET endpoint to poll transcription status
- Results stored as JSON files in `/tmp/fingerragio/`
- Uploaded files stored in `/tmp/fingerragio/uploads/`

## Key Design Decisions

### Piano Sound
- Uses `Tone.Sampler` with Salamander Grand Piano samples (NOT `@tonejs/piano` — that package requires Tone.js v14, we use v15)
- Samples hosted at `https://tonejs.github.io/audio/salamander/`
- Every 3rd note sampled for coverage vs load time balance

### Timing & Chord Sync (Two-Layer Architecture)
- **Audio layer**: ALL notes pre-scheduled onto `Tone.Transport` at exact times. Chords at same `startTime` get identical schedule time = sample-accurate sync. Speed handled by scaling scheduled times by `1/speed`.
- **Visual layer**: rAF loop reads `Tone.Transport.seconds` to drive `currentTime` and `activeNotes`. Never triggers audio.

### Sustain Pedal Simulation
- `src/lib/noteProcessing.ts` — `mergeOverlappingNotes()` merges same-pitch notes with gaps < 80ms
- Applied in `page.tsx` via `useMemo` before passing to all components
- Eliminates repeated key attacks caused by basic-pitch splitting sustained notes

### 88-Key Keyboard
- Full range A0-C8 (MIDI 21-108)
- Dynamic key width: scales to fill viewport (min 28px per white key)
- ResizeObserver in `page.tsx` computes `keyWidth` from container width
- Shared scroll container between FallingNotes and PianoKeyboard
- Auto-scrolls to center on active notes during playback

### YouTube Audio Download
- Uses **Piped API** (open-source YouTube proxy) as primary method — bypasses YouTube's datacenter IP blocks
- Tries multiple Piped instances: `pipedapi.kavin.rocks`, `watchapi.whatever.social`, `api.piped.yt`
- Falls back to `yt-dlp` if all Piped instances fail (works on local dev)
- Audio stream downloaded via `requests`, converted to WAV via `ffmpeg`

### Transcription
- Uses `basic-pitch` (Spotify) — fast on CPU with good polyphony detection
- Returns note events directly (start_time, end_time, pitch_midi, velocity, pitch_bend)
- No separate model download step required

### Sheet Music
- Uses `abcjs` to render standard musical notation from ABC notation format
- `src/lib/abcNotation.ts` converts `Note[]` → ABC string (handles chords, rests, barlines)
- `src/components/SheetMusic.tsx` renders with `TimingCallbacks.setProgress()` driven by `currentTime`
- Cursor sync uses Transport's time — no competing timer
- Dark-themed via CSS class overrides in `globals.css`

## File Upload
- SongInput has tabs: "YouTube" | "Upload File"
- Supported formats: `.mid`, `.midi`, `.xml`, `.mxl`, `.musicxml`
- Drag-and-drop + file picker
- ProcessingState has "uploading" status for file upload flow

## Conventions
- Dark theme by default
- No authentication required
- All components in `src/components/`
- Shared types in `src/lib/types.ts`
- Custom hooks in `src/hooks/`

## Deployment
- **Live URL**: https://fingerragio.innovariance.com (and fingerragio.pages.dev)
- **Platform**: Cloudflare Pages (static export, no Python backend)
- `scripts/deploy.sh` builds with `output: 'export'` (API routes excluded) and deploys via wrangler
- `next.config.ts` uses `CLOUDFLARE_BUILD=1` env var to switch to static export mode
- Cloudflare project name: `fingerragio`, account: teymurmammadzada@yahoo.com
- **Note**: YouTube transcription requires local dev server (Python backend). Cloudflare deploy is frontend-only.

## Known Issues / TODO
- Sheet music quantization is approximate — complex rhythms may not render perfectly
- Cloudflare Pages deployment is frontend-only — transcription needs local `npm run dev`
