import type{Clip}from'../../types/clip';
import type{IEditorCommand,CommandState}from'./types';
export class AddClipCommand implements IEditorCommand{
  readonly type='ADD_CLIP';readonly description:string;readonly timestamp=Date.now();
  private clip:Clip;
  constructor(clip:Clip){this.clip=clip;this.description=`클립 추가: ${clip.name}`;}
  execute(state:CommandState):CommandState{return{...state,clips:[...state.clips,{...this.clip}],selectedClipIds:[this.clip.id]};}
  undo(state:CommandState):CommandState{return{...state,clips:state.clips.filter(c=>c.id!==this.clip.id),selectedClipIds:state.selectedClipIds.filter(id=>id!==this.clip.id)};}
}
