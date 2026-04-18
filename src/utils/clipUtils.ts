import type{Clip}from'../types/clip';
export function clipsOverlap(a:Clip,b:Clip):boolean{if(a.trackId!==b.trackId||a.id===b.id)return false;return a.startFrame<b.startFrame+b.durationFrames&&b.startFrame<a.startFrame+a.durationFrames;}
export function getNextAvailableFrame(clips:Clip[],trackId:string):number{const tc=clips.filter(c=>c.trackId===trackId);if(tc.length===0)return 0;return Math.max(...tc.map(c=>c.startFrame+c.durationFrames));}
export function getClipsAfterFrame(clips:Clip[],trackId:string,frame:number):Clip[]{return clips.filter(c=>c.trackId===trackId&&c.startFrame>=frame).sort((a,b)=>a.startFrame-b.startFrame);}
