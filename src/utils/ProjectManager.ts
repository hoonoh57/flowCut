import { useEditorStore } from '../stores/editorStore';

export interface ProjectData {
  version: number;
  name: string;
  savedAt: string;
  fps: number;
  projectWidth: number;
  projectHeight: number;
  aspectPreset: string;
  fitMode: string;
  tracks: any[];
  clips: any[];
  zoomLevel: number;
  currentFrame: number;
  snapEnabled: boolean;
}

export function serializeProject(name: string): ProjectData {
  const s = useEditorStore.getState();
  return {
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    fps: s.fps,
    projectWidth: s.projectWidth,
    projectHeight: s.projectHeight,
    aspectPreset: s.aspectPreset,
    fitMode: s.fitMode,
    tracks: s.tracks,
    clips: s.clips.map(c => {
      const clone = { ...c };
      // Don't save blob URLs — they won't work after reload
      if (clone.src?.startsWith('blob:')) delete clone.src;
      if (clone.previewUrl?.startsWith('blob:')) delete clone.previewUrl;
      return clone;
    }),
    zoomLevel: s.zoomLevel,
    currentFrame: s.currentFrame,
    snapEnabled: s.snapEnabled,
  };
}

export function deserializeProject(data: ProjectData) {
  const s = useEditorStore.getState();
  s.setTracks(data.tracks);
  s.setClips(data.clips);
  s.setFps(data.fps);
  s.setProjectSize(data.projectWidth, data.projectHeight);
  s.setAspectPreset(data.aspectPreset as AspectPreset);
  s.setFitMode(data.fitMode as FitMode);
  s.setZoomLevel(data.zoomLevel);
  s.setCurrentFrame(data.currentFrame);
  s.setSnapEnabled(data.snapEnabled);
  s.setIsPlaying(false);
  s.clearSelection();
  s.clearHistory();
}

export function saveProjectToFile(name: string) {
  const data = serializeProject(name);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}.flowcut`;
  a.click();
  URL.revokeObjectURL(url);
}

export function saveProjectToLocalStorage(name: string) {
  const data = serializeProject(name);
  const key = `flowcut_project_${name}`;
  localStorage.setItem(key, JSON.stringify(data));
  localStorage.setItem('flowcut_last_project', key);
  return key;
}

export function loadProjectFromLocalStorage(key: string): ProjectData | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getProjectList(): { key: string; name: string; savedAt: string }[] {
  const list: { key: string; name: string; savedAt: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('flowcut_project_')) {
      try {
        const d = JSON.parse(localStorage.getItem(k) || '');
        list.push({ key: k, name: d.name || k, savedAt: d.savedAt || '' });
      } catch {}
    }
  }
  return list.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function loadProjectFromFile(): Promise<ProjectData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.flowcut,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const text = await file.text();
        resolve(JSON.parse(text));
      } catch { resolve(null); }
    };
    input.click();
  });
}