import type{StateCreator}from'zustand';
import type{Clip}from'../../types/clip';
import type{EditorStore}from'../editorStore';
export interface ClipSlice{clips:Clip[];selectedClipIds:string[];setClips:(c:Clip[])=>void;setSelectedClipIds:(ids:string[])=>void;selectClip:(id:string,multi?:boolean)=>void;clearSelection:()=>void;}
export const createClipSlice:StateCreator<EditorStore,[],[],ClipSlice>=(set,get)=>({clips:[],selectedClipIds:[],setClips:(c)=>set({clips:c}),setSelectedClipIds:(ids)=>set({selectedClipIds:ids}),selectClip:(id,multi=false)=>{const cur=get().selectedClipIds;if(multi){set({selectedClipIds:cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]});}else{set({selectedClipIds:[id]});}},clearSelection:()=>set({selectedClipIds:[]})});
