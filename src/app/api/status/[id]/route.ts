import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.join(process.env.TMPDIR || "/tmp", "fingerragio");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  // Sanitize the ID to prevent path traversal
  const safeId = path.basename(id);
  const statusFile = path.join(OUTPUT_DIR, `${safeId}.json`);

  try {
    if (!fs.existsSync(statusFile)) {
      return NextResponse.json({ status: "processing" });
    }

    const content = fs.readFileSync(statusFile, "utf-8");
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "processing" });
  }
}
