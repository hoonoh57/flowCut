import type { Clip } from '../types/clip';

export function hasCollision(
  clip: Clip, newStart: number, newTrackId: string, allClips: Clip[]
): boolean {
  const newEnd = newStart + clip.durationFrames;
  for (const c of allClips) {
    if (c.id === clip.id) continue;
    if (c.trackId !== newTrackId) continue;
    const cEnd = c.startFrame + c.durationFrames;
    if (newStart < cEnd && newEnd > c.startFrame) return true;
  }
  return false;
}

export function findNearestFreeStart(
  clip: Clip, desiredStart: number, trackId: string, allClips: Clip[]
): number {
  if (!hasCollision(clip, desiredStart, trackId, allClips)) return desiredStart;
  const sameTrack = allClips
    .filter(c => c.trackId === trackId && c.id !== clip.id)
    .sort((a, b) => a.startFrame - b.startFrame);
  for (const c of sameTrack) {
    const after = c.startFrame + c.durationFrames;
    if (!hasCollision(clip, after, trackId, allClips)) return after;
  }
  if (!hasCollision(clip, 0, trackId, allClips)) return 0;
  return desiredStart;
}

export function findNextAvailableFrame(trackId: string, allClips: Clip[]): number {
  const sameTrack = allClips.filter(c => c.trackId === trackId);
  if (sameTrack.length === 0) return 0;
  return Math.max(...sameTrack.map(c => c.startFrame + c.durationFrames));
}