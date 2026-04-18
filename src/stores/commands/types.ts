import type{Clip}from'../../types/clip';
import type{Track}from'../../types/track';
export interface CommandState{clips:Clip[];tracks:Track[];selectedClipIds:string[];}
export interface IEditorCommand{readonly type:string;readonly description:string;readonly timestamp:number;execute(state:CommandState):CommandState;undo(state:CommandState):CommandState;}
