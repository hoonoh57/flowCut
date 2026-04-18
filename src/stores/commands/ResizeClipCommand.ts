import type { Clip } from '../../types/clip';
import type { IEditorCommand, CommandState } from './types';

export class ResizeClipCommand implements IEditorCommand {
  readonly type = 'RESIZE_CLIP';
  readonly description: string;
  readonly timestamp = Date.now();
  private prevStart: number = 0;
  private prevDuration: number = 0;

  constructor(
    private clipId: string,
    private newStartFrame: number,
    private newDurationFrames: number
  ) {
    this.description = `Resize clip ${clipId}`;
  }

  execute(state: CommandState): CommandState {
    const clip = state.clips.find(c => c.id === this.clipId);
    if (!clip) return state;
    this.prevStart = clip.startFrame;
    this.prevDuration = clip.durationFrames;
    return {
      ...state,
      clips: state.clips.map(c =>
        c.id === this.clipId
          ? { ...c, startFrame: this.newStartFrame, durationFrames: this.newDurationFrames }
          : c
      ),
    };
  }

  undo(state: CommandState): CommandState {
    return {
      ...state,
      clips: state.clips.map(c =>
        c.id === this.clipId
          ? { ...c, startFrame: this.prevStart, durationFrames: this.prevDuration }
          : c
      ),
    };
  }
}