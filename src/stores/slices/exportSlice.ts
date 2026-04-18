import type{StateCreator}from'zustand';
import type{EditorStore}from'../editorStore';
export interface ExportSlice{isExporting:boolean;exportProgress:number;exportLog:string[];setIsExporting:(v:boolean)=>void;setExportProgress:(v:number)=>void;addExportLog:(m:string)=>void;clearExportLog:()=>void;}
export const createExportSlice:StateCreator<EditorStore,[],[],ExportSlice>=(set,get)=>({isExporting:false,exportProgress:0,exportLog:[],setIsExporting:(v)=>set({isExporting:v}),setExportProgress:(v)=>set({exportProgress:v}),addExportLog:(m)=>set({exportLog:[...get().exportLog,m]}),clearExportLog:()=>set({exportLog:[]})});
