import type { Clip } from '../../types/clip';
import type { IEditorCommand, CommandState } from './types';

export class UpdateClipCommand implements IEditorCommand {
  readonly type = 'UPDATE_CLIP';
  readonly description: string;
  readonly timestamp = Date.now();
  private prevValues: Partial<Clip> = {};

  constructor(
    private clipId: string,
    private newValues: Partial<Clip>
  ) {
    this.description = `Update clip ${clipId}`;
  }

  execute(state: CommandState): CommandState {
    const clip = state.clips.find(c => c.id === this.clipId);
    if (!clip) return state;

    // Save previous values for undo
    this.prevValues = {};
    for (const key of Object.keys(this.newValues) as (keyof Clip)[]) {
      (this.prevValues as Record<string, unknown>)[key] = (clip as Record<string, unknown>)[key];
    }

    return {
      ...state,
      clips: state.clips.map(c =>
        c.id === this.clipId ? { ...c, ...this.newValues } : c
      ),
    };
  }

  undo(state: CommandState): CommandState {
    return {
      ...state,
      clips: state.clips.map(c =>
        c.id === this.clipId ? { ...c, ...this.prevValues } : c
      ),
    };
  }
}