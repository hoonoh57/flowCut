import { getEnvelopeVolume } from '../types/clip';
import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;
let loaded = false;

export async function loadFFmpeg(
  onLog?: (msg: string) => void,
  onProgress?: (ratio: number) => void
): Promise<FFmpeg> {
  if (ffmpeg && loaded) return ffmpeg;
  ffmpeg = new FFmpeg();
  if (onLog) ffmpeg.on('log', ({ message }) => onLog(message));
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(progress));
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  });
  loaded = true;
  return ffmpeg;
}

export interface AudioTrackInfo {
  id: string;
  data: Uint8Array;
  ext: string;
  startSec: number;
  durationSec: number;
  volume: number;
  fadeInSec: number;
  fadeOutSec: number;
  muted: boolean;
}

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm' | 'gif';
  quality: 'high' | 'medium' | 'low';
  includeAudio: boolean;
  fileName: string;
  outputWidth?: number;
  outputHeight?: number;
  totalDurationSec: number;
}

const QUALITY_CRF: Record<string, number> = { high: 18, medium: 23, low: 28 };

export async function exportVideo(
  frames: Blob[],
  audioTracks: AudioTrackInfo[],
  options: ExportOptions,
  onProgress: (pct: number, msg: string) => void,
  onLog: (msg: string) => void,
  abortSignal: { aborted: boolean }
): Promise<Blob | null> {
  onLog('FFmpeg WASM loading...');
  onProgress(0, 'FFmpeg loading...');
  const ff = await loadFFmpeg(
    (msg) => onLog(`[ffmpeg] ${msg}`),
    (ratio) => onProgress(Math.round(ratio * 100), 'Encoding...')
  );

  // 1. Write frames
  onLog(`Writing ${frames.length} frames...`);
  for (let i = 0; i < frames.length; i++) {
    if (abortSignal.aborted) return null;
    const name = `frame_${String(i).padStart(6, '0')}.png`;
    const data = await frames[i].arrayBuffer();
    await ff.writeFile(name, new Uint8Array(data));
    if (i % 30 === 0) {
      onProgress(Math.round((i / frames.length) * 30), `Frame ${i}/${frames.length}`);
    }
  }

  // 2. Write audio files
  const activeAudio = audioTracks.filter(a => !a.muted && a.data.length > 0);
  if (activeAudio.length > 0) {
    onLog(`Writing ${activeAudio.length} audio tracks...`);
    for (let i = 0; i < activeAudio.length; i++) {
      const name = `audio_${i}.${activeAudio[i].ext}`;
      await ff.writeFile(name, activeAudio[i].data);
    }
  }

  const crf = QUALITY_CRF[options.quality] ?? 23;
  const ow = options.outputWidth || options.width;
  const oh = options.outputHeight || options.height;
  const needScale = ow !== options.width || oh !== options.height;
  const dur = options.totalDurationSec;

  // 3. Encode video (no audio first)
  onLog('Encoding video...');
  onProgress(35, 'Encoding video...');
  const scaleVf = needScale ? `scale=${ow}:${oh}:flags=lanczos` : null;

  if (options.format === 'gif') {
    const maxW = Math.min(ow, 640);
    const vfStr = `fps=${Math.min(options.fps, 15)},scale=${maxW}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
    await ff.exec(['-framerate', String(options.fps), '-i', 'frame_%06d.png', '-vf', vfStr, '-y', 'output.gif']);
    const output = await ff.readFile('output.gif');
    onLog(`GIF: ${(output.length / 1048576).toFixed(1)}MB`);
    onProgress(100, 'Complete!');
    return new Blob([output], { type: 'image/gif' });
  }

  // Encode silent video
  const vfArgs = scaleVf ? ['-vf', scaleVf] : [];
  if (options.format === 'mp4') {
    await ff.exec([
      '-framerate', String(options.fps), '-i', 'frame_%06d.png',
      ...vfArgs,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-y', 'video_only.mp4',
    ]);
  } else {
    await ff.exec([
      '-framerate', String(options.fps), '-i', 'frame_%06d.png',
      ...vfArgs,
      '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0',
      '-pix_fmt', 'yuv420p', '-y', 'video_only.webm',
    ]);
  }
  onProgress(60, 'Video encoded');

  // 4. Mix audio if any
  if (activeAudio.length > 0 && options.includeAudio) {
    onLog('Mixing audio...');
    onProgress(65, 'Mixing audio...');

    // Build complex audio filter
    const inputs: string[] = [];
    const filterParts: string[] = [];
    for (let i = 0; i < activeAudio.length; i++) {
      const a = activeAudio[i];
      inputs.push('-i', `audio_${i}.${a.ext}`);
      const vol = a.volume / 100;
      let af = `[${i + 1}:a]`;
      const effects: string[] = [];
      if (vol !== 1) effects.push(`volume=${vol.toFixed(2)}`);
      if (a.fadeInSec > 0) effects.push(`afade=t=in:st=0:d=${a.fadeInSec.toFixed(2)}`);
      if (a.fadeOutSec > 0) {
        const fadeStart = Math.max(0, a.durationSec - a.fadeOutSec);
        effects.push(`afade=t=out:st=${fadeStart.toFixed(2)}:d=${a.fadeOutSec.toFixed(2)}`);
      }
      const delayMs = Math.round(a.startSec * 1000);
      if (delayMs > 0) effects.push(`adelay=${delayMs}|${delayMs}`);

      if (effects.length > 0) {
        filterParts.push(`${af}${effects.join(',')}[a${i}]`);
        af = `[a${i}]`;
      } else {
        filterParts.push(`${af}anull[a${i}]`);
        af = `[a${i}]`;
      }
    }
    // Amix
    const mixInputs = activeAudio.map((_, i) => `[a${i}]`).join('');
    filterParts.push(`${mixInputs}amix=inputs=${activeAudio.length}:duration=longest:dropout_transition=0[aout]`);
    const filterComplex = filterParts.join(';');

    const ext = options.format === 'mp4' ? 'mp4' : 'webm';
    const videoFile = `video_only.${ext}`;
    const audioCodec = options.format === 'mp4' ? ['-c:a', 'aac', '-b:a', '192k'] : ['-c:a', 'libopus', '-b:a', '128k'];

    try {
      await ff.exec([
        '-i', videoFile,
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '0:v', '-map', '[aout]',
        '-c:v', 'copy',
        ...audioCodec,
        '-shortest',
        '-y', `output.${ext}`,
      ]);
      onProgress(90, 'Muxing complete');
    } catch (e: any) {
      onLog(`Audio mix failed, exporting video only: ${e.message}`);
      // Fallback: just copy video without audio
      await ff.exec(['-i', videoFile, '-c', 'copy', '-y', `output.${ext}`]);
    }
  } else {
    // No audio — just rename
    const ext = options.format === 'mp4' ? 'mp4' : 'webm';
    await ff.exec(['-i', `video_only.${ext}`, '-c', 'copy', '-y', `output.${ext}`]);
  }

  const ext = options.format === 'mp4' ? 'mp4' : 'webm';
  const mime = options.format === 'mp4' ? 'video/mp4' : 'video/webm';
  const output = await ff.readFile(`output.${ext}`);
  const sizeMB = (output.length / 1048576).toFixed(1);
  onLog(`Export complete: ${sizeMB}MB (${ow}x${oh})`);
  onProgress(100, 'Complete!');
  return new Blob([output], { type: mime });
}

export async function cleanupFFmpeg() {
  if (!ffmpeg || !loaded) return;
  try {
    const files = await ffmpeg.listDir('/');
    for (const f of files) {
      if (f.name !== '.' && f.name !== '..' && !f.isDir) {
        await ffmpeg.deleteFile(f.name);
      }
    }
  } catch {}
}