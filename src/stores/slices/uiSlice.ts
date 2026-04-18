import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editorStore';

export type LeftPanelTab = 'media' | 'text' | 'effects' | 'transitions' | 'audio' | 'ai' | 'project' | 'export';

export interface UISlice {
  leftPanelTab: LeftPanelTab;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  logPanelOpen: boolean;
  setLeftPanelTab: (t: LeftPanelTab) => void;
  setLeftPanelOpen: (o: boolean) => void;
  setRightPanelOpen: (o: boolean) => void;
  setLogPanelOpen: (o: boolean) => void;
}

export const createUISlice: StateCreator<EditorStore, [], [], UISlice> = (set) => ({
  leftPanelTab: 'media',
  leftPanelOpen: true,
  rightPanelOpen: true,
  logPanelOpen: false,
  setLeftPanelTab: (t) => set({ leftPanelTab: t }),
  setLeftPanelOpen: (o) => set({ leftPanelOpen: o }),
  setRightPanelOpen: (o) => set({ rightPanelOpen: o }),
  setLogPanelOpen: (o) => set({ logPanelOpen: o }),
});