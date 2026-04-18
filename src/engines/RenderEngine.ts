import type { Clip } from '../types/clip';

export interface RenderFrame {
  clips: { clip: Clip; progress: number }[];
  frame: number;
  fps: number;
}

export function getVisibleClips(clips: Clip[], frame: number): { clip: Clip; progress: number }[] {
  return clips
    .filter(c => frame >= c.startFrame && frame < c.startFrame + c.durationFrames)
    .sort((a, b) => {
      const pri: Record<string, number> = { text: 3, video: 2, image: 2, audio: 1 };
      return (pri[a.type] ?? 0) - (pri[b.type] ?? 0);
    })
    .map(c => ({
      clip: c,
      progress: (frame - c.startFrame) / c.durationFrames,
    }));
}

export function frameToPx(frame: number, fps: number, zoom: number): number {
  return (frame / fps) * 100 * zoom;
}

export function pxToFrame(px: number, fps: number, zoom: number): number {
  return Math.round((px / (100 * zoom)) * fps);
}