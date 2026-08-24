import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "@/lib/supabase";

type Context = { params: Promise<{ filename: string }> };

const BUCKET_NAME = "recordings";
const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  bin: "audio/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png"
};

export async function GET(request: Request, context: Context) {
  const { filename } = await context.params;
  const safeFilename = path.basename(filename);

  if (safeFilename !== filename) {
    return NextResponse.json({ error: "Invalid recording filename." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(safeFilename, 60 * 60);

    if (!error && data?.signedUrl) {
      return NextResponse.redirect(data.signedUrl, 307);
    }
  } catch {
    // Fall back to local development uploads below.
  }

  return serveLocalRecording(request, safeFilename);
}

async function serveLocalRecording(request: Request, filename: string) {
  const filePath = path.join(process.cwd(), ".local-uploads", filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  const fileStat = await stat(filePath);
  const range = request.headers.get("range");
  const contentType = MIME_TYPES[filename.split(".").pop() ?? ""] ?? "application/octet-stream";

  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : fileStat.size - 1;
      const safeEnd = Math.min(end, fileStat.size - 1);

      if (start <= safeEnd && start < fileStat.size) {
        const data = await readFile(filePath);
        const chunk = data.subarray(start, safeEnd + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${safeEnd}/${fileStat.size}`,
            "Content-Length": String(chunk.length),
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
    }
  }

  const data = await readFile(filePath);
  return new NextResponse(data, {
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=3600"
    }
  });
}
