import type{Clip}from'../../types/clip';
import type{IEditorCommand,CommandState}from'./types';
import{uid}from'../../utils/uid';
export class SplitClipCommand implements IEditorCommand{
  readonly type='SPLIT_CLIP';readonly description='클립 분할';readonly timestamp=Date.now();
  private originalClip:Clip|null=null;private leftId:string;private rightId:string;
  constructor(private clipId:string,private splitFrame:number){this.leftId=clipId;this.rightId=uid();}
  execute(state:CommandState):CommandState{const clip=state.clips.find(c=>c.id===this.clipId);if(!clip)return state;const lf=this.splitFrame-clip.startFrame;if(lf<=0||lf>=clip.durationFrames)return state;this.originalClip={...clip};const left:Clip={...clip,id:this.leftId,durationFrames:lf,sourceDuration:(lf/clip.durationFrames)*clip.sourceDuration};const right:Clip={...clip,id:this.rightId,name:`${clip.name}(2)`,startFrame:clip.startFrame+lf,durationFrames:clip.durationFrames-lf,sourceStart:clip.sourceStart+(lf/clip.durationFrames)*clip.sourceDuration,sourceDuration:((clip.durationFrames-lf)/clip.durationFrames)*clip.sourceDuration};return{...state,clips:[...state.clips.filter(c=>c.id!==this.clipId),left,right],selectedClipIds:[this.leftId]};}
  undo(state:CommandState):CommandState{if(!this.originalClip)return state;return{...state,clips:[...state.clips.filter(c=>c.id!==this.leftId&&c.id!==this.rightId),{...this.originalClip}],selectedClipIds:[this.originalClip.id]};}
}
