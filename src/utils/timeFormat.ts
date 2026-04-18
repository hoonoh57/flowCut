export function frameToTime(frame:number,fps:number):string{const t=frame/fps;const m=Math.floor(t/60);const s=Math.floor(t%60);const f=Math.floor(frame%fps);return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;}
export function frameToSeconds(frame:number,fps:number):number{return frame/fps;}
export function secondsToFrame(seconds:number,fps:number):number{return Math.round(seconds*fps);}
