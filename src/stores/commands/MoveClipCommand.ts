import type{IEditorCommand,CommandState}from'./types';
export class MoveClipCommand implements IEditorCommand{
  readonly type='MOVE_CLIP';readonly description='클립 이동';readonly timestamp=Date.now();
  constructor(private clipId:string,private fromTrackId:string,private fromStartFrame:number,private toTrackId:string,private toStartFrame:number){}
  execute(state:CommandState):CommandState{return{...state,clips:state.clips.map(c=>c.id===this.clipId?{...c,trackId:this.toTrackId,startFrame:this.toStartFrame}:c)};}
  undo(state:CommandState):CommandState{return{...state,clips:state.clips.map(c=>c.id===this.clipId?{...c,trackId:this.fromTrackId,startFrame:this.fromStartFrame}:c)};}
}
