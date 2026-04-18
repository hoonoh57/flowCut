import type { Clip } from '../types/clip';

const SNAP_THRESHOLD_PX = 8;

export interface SnapResult {
  frame: number;
  snapped: boolean;
  snapLine: number | null;
}

export function snapToGrid(
  frame: number,
  allClips: Clip[],
  excludeId: string,
  fps: number,
  zoom: number
): SnapResult {
  const pxPerFrame = (100 * zoom) / fps;
  const thresholdFrames = Math.ceil(SNAP_THRESHOLD_PX / pxPerFrame);

  const edges: number[] = [0];
  for (const c of allClips) {
    if (c.id === excludeId) continue;
    edges.push(c.startFrame, c.startFrame + c.durationFrames);
  }
  // snap to seconds
  const maxSec = Math.ceil(frame / fps) + 2;
  for (let s = 0; s <= maxSec; s++) edges.push(s * fps);

  let best = frame;
  let bestDist = Infinity;
  for (const e of edges) {
    const d = Math.abs(frame - e);
    if (d < bestDist && d <= thresholdFrames) {
      bestDist = d;
      best = e;
    }
  }
  return {
    frame: best,
    snapped: best !== frame,
    snapLine: best !== frame ? best : null,
  };
}