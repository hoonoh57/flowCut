import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editorStore';

export interface MediaItem {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  url: string;
  objectUrl?: string;
  localPath?: string;
  duration: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  file?: File;
  size: number;
}

export interface MediaSlice {
  mediaItems: MediaItem[];
  addMediaItem: (item: MediaItem) => void;
  removeMediaItem: (id: string) => void;
  clearMedia: () => void;
}

export const createMediaSlice: StateCreator<EditorStore, [], [], MediaSlice> = (set, get) => ({
  mediaItems: [],
  addMediaItem: (item) => set({ mediaItems: [...get().mediaItems, item] }),
  removeMediaItem: (id) => set({
    mediaItems: get().mediaItems.filter((m) => m.id !== id),
  }),
  clearMedia: () => set({ mediaItems: [] }),
});
