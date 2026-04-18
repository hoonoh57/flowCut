import React from 'react';
import { theme } from '../../styles/theme';
import { useEditorStore } from '../../stores/editorStore';
import type { Track } from '../../stores/slices/trackSlice';

const TRACK_HEIGHT = 60;

interface TrackLabelProps {
  track: Track;
}

export const TrackLabel: React.FC<TrackLabelProps> = ({ track }) => {
  const dispatch = useEditorStore((s) => s.dispatch);
  const setTracks = useEditorStore((s) => s.setTracks);
  const tracks = useEditorStore((s) => s.tracks);

  const typeColor = track.type === 'video'
    ? theme.colors.track.video
    : track.type === 'audio'
    ? theme.colors.track.audio
    : theme.colors.track.text;

  const toggleLock = () => {
    setTracks(tracks.map(t => t.id === track.id ? { ...t, locked: !t.locked } : t));
  };
  const toggleVisible = () => {
    setTracks(tracks.map(t => t.id === track.id ? { ...t, visible: t.visible === false ? true : false } : t));
  };

  return (
    <div style={{
      height: TRACK_HEIGHT,
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      gap: 6,
      borderBottom: `1px solid ${theme.colors.border.default}`,
      background: theme.colors.bg.secondary,
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 4,
        height: 28,
        borderRadius: 2,
        background: typeColor,
        flexShrink: 0,
      }} />
      <span style={{
        flex: 1,
        fontSize: theme.fontSize.sm,
        color: theme.colors.text.primary,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        {track.name}
      </span>
      <button onClick={toggleVisible} title={track.visible === false ? 'Show' : 'Hide'} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 14,
        color: track.visible === false ? theme.colors.text.muted : theme.colors.text.secondary,
      }}>
        {track.visible === false ? '\u{1F648}' : '\u{1F441}'}
      </button>
      <button onClick={toggleLock} title={track.locked ? 'Unlock' : 'Lock'} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 14,
        color: track.locked ? theme.colors.accent.amber : theme.colors.text.secondary,
      }}>
        {track.locked ? '\u{1F512}' : '\u{1F513}'}
      </button>
    </div>
  );
};