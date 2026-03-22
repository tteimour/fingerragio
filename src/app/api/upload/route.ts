import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.join(process.env.TMPDIR || "/tmp", "fingerragio");
const UPLOAD_DIR = path.join(OUTPUT_DIR, "uploads");

const ALLOWED_EXTENSIONS = [".mid", ".midi", ".xml", ".mxl", ".musicxml"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const jobId = randomUUID();

    // Ensure directories exist
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    // Save the uploaded file
    const filePath = path.join(UPLOAD_DIR, `${jobId}${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Write initial status
    const statusFile = path.join(OUTPUT_DIR, `${jobId}.json`);
    fs.writeFileSync(statusFile, JSON.stringify({ status: "transcribing" }));

    // Spawn Python script in file mode
    const scriptPath = path.join(process.cwd(), "scripts", "transcribe.py");
    const child = spawn("python3", [scriptPath, "file", filePath, OUTPUT_DIR, jobId], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({ id: jobId });
  } catch {
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
