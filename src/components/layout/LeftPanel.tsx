import React, { useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useMediaImport } from '../../hooks/useMediaImport';
import { theme } from '../../styles/theme';
import { createMediaClipFromItem } from '../../utils/clipFactory';
// clip creation via clipFactory
import { AddClipCommand } from '../../stores/commands/AddClipCommand';
import { findNextAvailableFrame } from '../../engines/CollisionEngine';
import { TextPanel } from '../panels/TextPanel';
import { EffectsPanel } from '../panels/EffectsPanel';
import { TransitionsPanel } from '../panels/TransitionsPanel';
import { AudioPanel } from '../panels/AudioPanel';
import { AIPanel } from '../panels/AIPanel';
import { ProjectPanel } from '../panels/ProjectPanel';
import { ExportPanel } from '../export/ExportPanel';
import type { LeftPanelTab } from '../../stores/slices/uiSlice';
import type { MediaItem } from '../../stores/slices/mediaSlice';

const tabs: { key: LeftPanelTab; icon: string; label: string }[] = [
  { key: 'media', icon: '📁', label: '미디어' },
  { key: 'text', icon: 'T', label: '텍스트' },
  { key: 'effects', icon: '✨', label: '효과' },
  { key: 'transitions', icon: '➡', label: '전환' },
  { key: 'audio', icon: '♫', label: '오디오' },
  { key: 'ai', icon: '🤖', label: 'AI' },
  { key: 'project', icon: '💾', label: '프로젝트' },
  { key: 'export', icon: '🎬', label: '내보내기' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1048576).toFixed(1) + 'MB';
}
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60); const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function MediaPanel() {
  const mediaItems = useEditorStore((s) => s.mediaItems);
  const removeMediaItem = useEditorStore((s) => s.removeMediaItem);
  const dispatch = useEditorStore((s) => s.dispatch);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const fps = useEditorStore((s) => s.fps);
  const { openFilePicker, importFiles } = useMediaImport();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files.length > 0) importFiles(e.dataTransfer.files);
  }, [importFiles]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);

  const addToTimeline = useCallback((item: MediaItem) => {
    const trackType = item.type === 'audio' ? 'audio' : 'video';
    const track = tracks.find(t => t.type === trackType);
    if (!track) return;
    const startFrame = findNextAvailableFrame(track.id, clips);
    const clip = createMediaClipFromItem(item, track.id, startFrame, fps);
    dispatch(new AddClipCommand(clip));
  }, [tracks, clips, fps, dispatch]);

  const handleMediaDragStart = useCallback((e: React.DragEvent, item: MediaItem) => {
    e.dataTransfer.setData('application/x-media', JSON.stringify({
      id: item.id, name: item.name, type: item.type, duration: item.duration,
      width: item.width, height: item.height, url: item.url || item.objectUrl,
      localPath: item.localPath || '',
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div onDrop={handleDrop} onDragOver={handleDragOver}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={openFilePicker} style={{
        width: '100%', padding: '10px 0', border: `2px dashed ${theme.colors.border.strong}`,
        borderRadius: theme.radius.md, background: 'transparent', cursor: 'pointer',
        color: theme.colors.accent.blue, fontSize: 13, fontWeight: 600,
      }}>+ {'파일 가져오기'}</button>
      <div style={{ fontSize: 10, color: theme.colors.text.muted, textAlign: 'center' }}>
        {'또는 파일을 여기에 드래그하세요'}
      </div>
      {mediaItems.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme.colors.text.muted, fontSize: 11 }}>{'미디어 없음'}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flex: 1 }}>
        {mediaItems.map(item => (
          <div key={item.id} draggable onDragStart={(e) => handleMediaDragStart(e, item)}
            onDoubleClick={() => addToTimeline(item)}
            style={{ display: 'flex', gap: 8, padding: 6, borderRadius: theme.radius.sm,
              background: theme.colors.bg.elevated, cursor: 'grab',
              border: `1px solid ${theme.colors.border.subtle}` }}>
            <div style={{ width: 56, height: 32, borderRadius: 3, overflow: 'hidden',
              background: '#000', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.thumbnail
                ? <img src={item.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 16 }}>{item.type === 'audio' ? '♫' : item.type === 'image' ? '🖼' : '🎬'}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: theme.colors.text.primary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
              <div style={{ fontSize: 9, color: theme.colors.text.muted }}>
                {formatDuration(item.duration)} &middot; {formatSize(item.size)}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); removeMediaItem(item.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: theme.colors.text.muted, fontSize: 11, padding: 2, alignSelf: 'center' }}>&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeftPanel() {
  const at = useEditorStore((s) => s.leftPanelTab);
  const st = useEditorStore((s) => s.setLeftPanelTab);

  const renderContent = () => {
    switch (at) {
      case 'media': return <MediaPanel />;
      case 'text': return <TextPanel />;
      case 'effects': return <EffectsPanel />;
      case 'transitions': return <TransitionsPanel />;
      case 'audio': return <AudioPanel />;
      case 'ai': return <AIPanel />;
      case 'project': return <ProjectPanel />;
      case 'export': return <ExportPanel />;
      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 48, background: theme.colors.bg.primary,
        borderRight: `1px solid ${theme.colors.border.subtle}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 2 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => st(tab.key)} title={tab.label}
            style={{ width: 40, height: 40, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: theme.radius.sm,
              background: at === tab.key ? theme.colors.bg.elevated : 'transparent',
              color: at === tab.key ? theme.colors.text.primary : theme.colors.text.muted,
              cursor: 'pointer', fontSize: 16, gap: 1 }}>
            <span>{tab.icon}</span><span style={{ fontSize: 9 }}>{tab.label}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, padding: theme.spacing.lg, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: theme.fontSize.lg, fontWeight: 600,
          marginBottom: theme.spacing.lg, color: theme.colors.text.primary }}>
          {tabs.find(t => t.key === at)?.label}
        </div>
        {renderContent()}
      </div>
    </div>
  );
}