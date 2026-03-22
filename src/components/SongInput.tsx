"use client";

import { useState, useRef, useCallback } from "react";
import { Search, Music, Upload, FileMusic } from "lucide-react";

interface SongInputProps {
  onSubmit: (url: string) => void;
  onFileUpload: (file: File) => void;
  disabled?: boolean;
}

type Tab = "youtube" | "upload";

const ALLOWED_EXTENSIONS = [".mid", ".midi", ".xml", ".mxl", ".musicxml"];

export default function SongInput({ onSubmit, onFileUpload, disabled }: SongInputProps) {
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("youtube");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  const handleFile = useCallback((file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return;
    }
    onFileUpload(file);
  }, [onFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="w-full max-w-2xl">
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-900 p-1">
        <button
          onClick={() => setActiveTab("youtube")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "youtube"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          <Music size={16} />
          YouTube
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "upload"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          <Upload size={16} />
          Upload File
        </button>
      </div>

      {/* YouTube tab */}
      {activeTab === "youtube" && (
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
              <Music size={20} />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a YouTube URL (e.g. https://youtube.com/watch?v=...)"
              disabled={disabled}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-4 pl-12 pr-32 text-white placeholder-zinc-500 outline-none transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={disabled || !url.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search size={16} />
              Analyze
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            YouTube analysis requires running locally. For the hosted version, use file upload instead.
          </p>
        </form>
      )}

      {/* Upload tab */}
      {activeTab === "upload" && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors ${
            dragOver
              ? "border-purple-500 bg-purple-500/10"
              : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="rounded-full bg-zinc-800 p-3">
            <FileMusic size={28} className="text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="font-medium text-white">
              Drop a file here or click to browse
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Supports MIDI (.mid, .midi) and MusicXML (.xml, .mxl, .musicxml)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi,.xml,.mxl,.musicxml"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
