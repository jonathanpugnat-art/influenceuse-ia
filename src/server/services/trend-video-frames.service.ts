import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { downloadTrendCdnAsset } from "@/lib/trends/trend-cdn-download";
import { uploadFile } from "@/server/services/storage.service";

async function downloadVideo(url: string, dest: string): Promise<void> {
  const downloaded = await downloadTrendCdnAsset(url, {
    maxBytes: 80 * 1024 * 1024,
    timeoutMs: 90_000,
  });
  if (!downloaded) {
    throw new Error("Video download failed");
  }
  await writeFile(dest, downloaded.buffer);
}

function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

async function extractFrameAt(
  videoPath: string,
  seconds: number,
  outputPath: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(seconds),
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        outputPath,
      ],
      { stdio: "ignore" }
    );
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Extract evenly spaced keyframes from a trend MP4 for vision analysis.
 * Requires ffmpeg on the host; returns [] when unavailable.
 */
export async function extractTrendVideoFrameUrls(
  videoUrl: string,
  trendItemId: string,
  count = 6
): Promise<string[]> {
  if (!(await ffmpegAvailable())) {
    console.warn("[trend-video-frames] ffmpeg not available — skipping frame extract");
    return [];
  }

  const dir = await mkdtemp(join(tmpdir(), `trend-frames-${trendItemId}-`));
  const videoPath = join(dir, "source.mp4");

  try {
    await downloadVideo(videoUrl, videoPath);
    const frameCount = Math.min(Math.max(count, 3), 8);
    const urls: string[] = [];

    for (let i = 0; i < frameCount; i++) {
      const seconds = i === 0 ? 0.5 : (i / (frameCount - 1)) * 4;
      const framePath = join(dir, `frame_${i}.jpg`);
      try {
        await extractFrameAt(videoPath, seconds, framePath);
        const frameBuffer = await readFile(framePath);
        const stored = await uploadFile(
          frameBuffer,
          `trend-frame-${trendItemId}-${i}-${nanoid(4)}.jpg`,
          "image/jpeg"
        );
        urls.push(stored);
      } catch {
        // Skip individual frame failures.
      }
    }

    return urls;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
