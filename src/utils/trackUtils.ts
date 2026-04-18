import type{Track}from'../types/track';import type{Clip}from'../types/clip';
export function isCompatible(ct:Clip['type'],tt:Track['type']):boolean{if(tt==='video')return ct==='video'||ct==='image';if(tt==='audio')return ct==='audio';if(tt==='text')return ct==='text';return false;}
export function getTrackLayerOrder(tracks:Track[]):Map<string,number>{const s=[...tracks].sort((a,b)=>a.order-b.order);const m=new Map<string,number>();s.forEach((t,i)=>m.set(t.id,i));return m;}
