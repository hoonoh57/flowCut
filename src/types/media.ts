export interface MediaItem {
  id:string; name:string; type:'video'|'image'|'audio'; file:File; previewUrl:string; duration:number; width?:number; height?:number; size:number; addedAt:number;
}
