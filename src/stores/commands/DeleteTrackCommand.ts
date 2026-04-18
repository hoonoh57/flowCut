import type { Track } from '../../types/track';
import type { Clip } from '../../types/clip';
import type { IEditorCommand, CommandState } from './types';

export class DeleteTrackCommand implements IEditorCommand {
  readonly type = 'DELETE_TRACK';
  readonly description: string;
  readonly timestamp = Date.now();
  private deletedTrack: Track | null = null;
  private deletedClips: Clip[] = [];

  constructor(private trackId: string) {
    this.description = 'Delete track';
  }

  execute(state: CommandState): CommandState {
    this.deletedTrack = state.tracks.find((t) => t.id === this.trackId) || null;
    this.deletedClips = state.clips.filter((c) => c.trackId === this.trackId);

    return {
      ...state,
      tracks: state.tracks.filter((t) => t.id !== this.trackId),
      clips: state.clips.filter((c) => c.trackId !== this.trackId),
      selectedClipIds: state.selectedClipIds.filter(
        (id) => !this.deletedClips.some((c) => c.id === id)
      ),
    };
  }

  undo(state: CommandState): CommandState {
    if (!this.deletedTrack) return state;
    return {
      ...state,
      tracks: [...state.tracks, { ...this.deletedTrack }],
      clips: [...state.clips, ...this.deletedClips.map((c) => ({ ...c }))],
    };
  }
}
