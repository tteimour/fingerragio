export interface Note {
  midi: number;
  startTime: number;
  duration: number;
  velocity: number;
}

export interface SongData {
  id: string;
  title: string;
  notes: Note[];
  duration: number;
}

export interface ProcessingState {
  status: "idle" | "uploading" | "downloading" | "transcribing" | "complete" | "error";
  songData?: SongData;
  error?: string;
  jobId?: string;
}
