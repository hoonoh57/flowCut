import type { Track } from '../../types/track';
import type { IEditorCommand, CommandState } from './types';

export class AddTrackCommand implements IEditorCommand {
  readonly type = 'ADD_TRACK';
  readonly description: string;
  readonly timestamp = Date.now();

  constructor(private track: Track) {
    this.description = `Add track: ${track.name}`;
  }

  execute(state: CommandState): CommandState {
    return {
      ...state,
      tracks: [...state.tracks, { ...this.track }],
    };
  }

  undo(state: CommandState): CommandState {
    return {
      ...state,
      tracks: state.tracks.filter((t) => t.id !== this.track.id),
    };
  }
}
