import type{Clip}from'../../types/clip';
import type{IEditorCommand,CommandState}from'./types';
export class RippleDeleteCommand implements IEditorCommand{
  readonly type='RIPPLE_DELETE';readonly description='리플 삭제';readonly timestamp=Date.now();
  private deletedClip:Clip|null=null;private movedClips:{id:string;prevStartFrame:number}[]=[];
  constructor(private clipId:string){}
  execute(state:CommandState):CommandState{const clip=state.clips.find(c=>c.id===this.clipId);if(!clip)return state;this.deletedClip={...clip};const gap=clip.durationFrames;const clipEnd=clip.startFrame+clip.durationFrames;const toMove=state.clips.filter(c=>c.trackId===clip.trackId&&c.id!==clip.id&&c.startFrame>=clipEnd);this.movedClips=toMove.map(c=>({id:c.id,prevStartFrame:c.startFrame}));const newClips=state.clips.filter(c=>c.id!==this.clipId).map(c=>{if(toMove.some(m=>m.id===c.id))return{...c,startFrame:c.startFrame-gap};return c;});return{...state,clips:newClips,selectedClipIds:state.selectedClipIds.filter(id=>id!==this.clipId)};}
  undo(state:CommandState):CommandState{if(!this.deletedClip)return state;const restored=state.clips.map(c=>{const m=this.movedClips.find(mv=>mv.id===c.id);if(m)return{...c,startFrame:m.prevStartFrame};return c;});return{...state,clips:[...restored,{...this.deletedClip}],selectedClipIds:[this.deletedClip.id]};}
}
