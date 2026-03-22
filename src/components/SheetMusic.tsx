"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Note } from "@/lib/types";
import { notesToAbc } from "@/lib/abcNotation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AbcjsModule = any;

interface SheetMusicProps {
  notes: Note[];
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  title?: string;
}

export default function SheetMusic({
  notes,
  currentTime,
  isPlaying,
  duration,
  title,
}: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const abcjsRef = useRef<AbcjsModule>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timingRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const lastProgressRef = useRef(0);

  // Generate ABC notation
  const abcStringRef = useRef<string>("");
  useEffect(() => {
    abcStringRef.current = notesToAbc(notes, { title });
  }, [notes, title]);

  // Dynamically import abcjs (SSR-safe)
  useEffect(() => {
    let cancelled = false;
    import("abcjs").then((mod) => {
      if (!cancelled) {
        abcjsRef.current = mod;
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render ABC notation
  useEffect(() => {
    if (!loaded || !containerRef.current || !abcjsRef.current) return;
    const abcjs = abcjsRef.current;
    if (!abcStringRef.current) return;

    const visualObj = abcjs.renderAbc(containerRef.current, abcStringRef.current, {
      add_classes: true,
      responsive: "resize",
      staffwidth: 800,
      wrap: {
        minSpacing: 1.5,
        maxSpacing: 3,
        preferredMeasuresPerLine: 4,
      },
      paddingtop: 10,
      paddingbottom: 10,
      paddingleft: 10,
      paddingright: 10,
    });

    // Create timing callbacks for cursor sync
    if (visualObj?.[0] && duration > 0) {
      timingRef.current = new abcjs.TimingCallbacks(visualObj[0], {
        eventCallback: (event: { elements?: Element[][] } | null) => {
          // Remove previous highlights
          containerRef.current?.querySelectorAll(".abcjs-highlight").forEach((el: Element) => {
            el.classList.remove("abcjs-highlight");
          });
          // Add highlight to current elements
          if (event?.elements) {
            for (const elArr of event.elements) {
              for (const el of elArr) {
                el.classList.add("abcjs-highlight");
                el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
              }
            }
          }
        },
      });
    }

    return () => {
      if (timingRef.current) {
        timingRef.current.stop();
        timingRef.current = null;
      }
    };
  }, [loaded, notes, title, duration]);

  // Sync cursor position with currentTime
  const syncCursor = useCallback(() => {
    if (!timingRef.current || duration <= 0) return;
    const progress = Math.min(currentTime / duration, 1);
    if (Math.abs(progress - lastProgressRef.current) < 0.005) return;
    lastProgressRef.current = progress;

    try {
      timingRef.current.setProgress(progress);
    } catch {
      // abcjs may throw if notation is very short
    }
  }, [currentTime, duration]);

  useEffect(() => {
    syncCursor();
  }, [syncCursor]);

  // Start/stop timing callbacks based on playback state
  useEffect(() => {
    if (!timingRef.current) return;
    if (isPlaying) {
      try {
        timingRef.current.start();
        if (duration > 0) {
          timingRef.current.setProgress(Math.min(currentTime / duration, 1));
        }
      } catch {
        // Ignore
      }
    } else {
      try {
        timingRef.current.pause();
      } catch {
        // Ignore
      }
    }
  }, [isPlaying, currentTime, duration]);

  if (notes.length === 0) return null;

  return (
    <div
      className="sheet-music-container mx-4 mb-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
      style={{ maxHeight: "220px" }}
    >
      <div ref={containerRef} className="sheet-music-render" />
      {!loaded && (
        <div className="flex h-20 items-center justify-center text-sm text-zinc-500">
          Loading sheet music...
        </div>
      )}
    </div>
  );
}
