import type{Clip}from'../../types/clip';
import type{IEditorCommand,CommandState}from'./types';
export class DeleteClipCommand implements IEditorCommand{
  readonly type='DELETE_CLIP';description:string;readonly timestamp=Date.now();
  private clipId:string;private snapshot:Clip|null=null;
  constructor(clipId:string){this.clipId=clipId;this.description='클립 삭제';}
  execute(state:CommandState):CommandState{this.snapshot=state.clips.find(c=>c.id===this.clipId)||null;if(!this.snapshot)return state;this.description=`클립 삭제: ${this.snapshot.name}`;return{...state,clips:state.clips.filter(c=>c.id!==this.clipId),selectedClipIds:state.selectedClipIds.filter(id=>id!==this.clipId)};}
  undo(state:CommandState):CommandState{if(!this.snapshot)return state;return{...state,clips:[...state.clips,{...this.snapshot}],selectedClipIds:[this.snapshot.id]};}
}
