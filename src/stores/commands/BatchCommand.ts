import type{IEditorCommand,CommandState}from'./types';
export class BatchCommand implements IEditorCommand{
  readonly type='BATCH';readonly description:string;readonly timestamp=Date.now();
  constructor(private commands:IEditorCommand[],description?:string){this.description=description||'batch';}
  execute(state:CommandState):CommandState{return this.commands.reduce((s,cmd)=>cmd.execute(s),state);}
  undo(state:CommandState):CommandState{return[...this.commands].reverse().reduce((s,cmd)=>cmd.undo(s),state);}
}
