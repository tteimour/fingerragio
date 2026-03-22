import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.join(process.env.TMPDIR || "/tmp", "fingerragio");

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Basic YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
    if (!youtubeRegex.test(url)) {
      return NextResponse.json(
        { error: "Please provide a valid YouTube URL" },
        { status: 400 }
      );
    }

    const jobId = randomUUID();

    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Write initial status
    const statusFile = path.join(OUTPUT_DIR, `${jobId}.json`);
    fs.writeFileSync(statusFile, JSON.stringify({ status: "downloading" }));

    // Spawn Python transcription script
    const scriptPath = path.join(process.cwd(), "scripts", "transcribe.py");
    const child = spawn("python3", [scriptPath, "youtube", url, OUTPUT_DIR, jobId], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({ id: jobId });
  } catch {
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}
