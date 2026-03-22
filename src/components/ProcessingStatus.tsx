"use client";

import { Loader2, Download, FileAudio, AlertCircle, Upload } from "lucide-react";

interface ProcessingStatusProps {
  status: "uploading" | "downloading" | "transcribing" | "error";
  error?: string;
}

const statusConfig = {
  uploading: {
    icon: Upload,
    label: "Uploading file...",
    sublabel: "Preparing your file for processing",
  },
  downloading: {
    icon: Download,
    label: "Downloading audio from YouTube...",
    sublabel: "This may take a moment depending on the video length",
  },
  transcribing: {
    icon: FileAudio,
    label: "Transcribing audio to piano notes...",
    sublabel: "AI is analyzing the audio for piano notes",
  },
  error: {
    icon: AlertCircle,
    label: "Something went wrong",
    sublabel: "",
  },
};

export default function ProcessingStatus({ status, error }: ProcessingStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-zinc-900 p-8 text-center">
      {status === "error" ? (
        <div className="rounded-full bg-red-500/10 p-4">
          <Icon size={32} className="text-red-400" />
        </div>
      ) : (
        <div className="relative">
          <div className="rounded-full bg-purple-500/10 p-4">
            <Icon size={32} className="text-purple-400" />
          </div>
          <Loader2 size={64} className="absolute -top-2 -left-2 animate-spin text-purple-500/30" />
        </div>
      )}
      <div>
        <p className="text-lg font-medium text-white">{config.label}</p>
        <p className="mt-1 text-sm text-zinc-400">
          {status === "error" ? error || "An unexpected error occurred" : config.sublabel}
        </p>
      </div>
    </div>
  );
}
