import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { createDefaultClip } from '../../types/clip';
import { AddClipCommand } from '../../stores/commands/AddClipCommand';
import { AddTrackCommand } from '../../stores/commands/AddTrackCommand';
import { SplitClipCommand } from '../../stores/commands/SplitClipCommand';
import { RippleDeleteCommand } from '../../stores/commands/RippleDeleteCommand';
import { DeleteClipCommand } from '../../stores/commands/DeleteClipCommand';
import { frameToTime } from '../../utils/timeFormat';
import { theme } from '../../styles/theme';
import { uid } from '../../utils/uid';
import type { Track } from '../../stores/slices/trackSlice';



export const TimelineControls: React.FC = () => {
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const fps = useEditorStore((s) => s.fps);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const dispatch = useEditorStore((s) => s.dispatch);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);

  const maxFrame = clips.reduce((mx, c) => Math.max(mx, c.startFrame + c.durationFrames), 0);

  const goStart = () => setCurrentFrame(0);
  const goEnd = () => setCurrentFrame(maxFrame);
  const prevFrame = () => setCurrentFrame(Math.max(0, currentFrame - 1));
  const nextFrame = () => setCurrentFrame(currentFrame + 1);
  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleSplit = () => {
    if (selectedClipIds.length === 0) return;
    const clip = clips.find(c => c.id === selectedClipIds[0]);
    if (!clip) return;
    if (currentFrame <= clip.startFrame || currentFrame >= clip.startFrame + clip.durationFrames) return;
    dispatch(new SplitClipCommand(clip.id, currentFrame));
  };

  const handleRippleDelete = () => {
    if (selectedClipIds.length === 0) return;
    const clip = clips.find(c => c.id === selectedClipIds[0]);
    if (!clip) return;
    dispatch(new RippleDeleteCommand(clip.id, clip.trackId));
  };

  const handleDelete = () => {
    if (selectedClipIds.length === 0) return;
    const clip = clips.find(c => c.id === selectedClipIds[0]);
    if (!clip) return;
    dispatch(new DeleteClipCommand(clip.id));
  };

  const addTrack = (type: 'video' | 'audio' | 'text') => {
    const sameType = tracks.filter(t => t.type === type);
    const maxOrder = sameType.reduce((m, t) => Math.max(m, t.order ?? 0), 0);
    const newTrack: Track = {
      id: uid(), name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${sameType.length + 1}`,
      type, order: maxOrder + 1, height: 60, locked: false, visible: true,
    };
    dispatch(new AddTrackCommand(newTrack));
  };

  const addTestClip = () => {
    const vTrack = tracks.find(t => t.type === 'video');
    if (!vTrack) return;
    const clip = createDefaultClip({
      id: uid(), name: 'Test Clip', type: 'video',
      trackId: vTrack.id, startFrame: currentFrame, durationFrames: fps * 5,
    });
    dispatch(new AddClipCommand(clip));
  };

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? theme.colors.accent.blue : theme.colors.bg.elevated,
    color: active ? '#fff' : theme.colors.text.secondary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.radius.sm,
    padding: '4px 8px', cursor: 'pointer', fontSize: theme.fontSize.xs, whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
      background: theme.colors.bg.secondary,
      borderBottom: `1px solid ${theme.colors.border.default}`, flexWrap: 'wrap',
    }}>
      <button onClick={goStart} style={btnStyle()}>&#x23EE;</button>
      <button onClick={prevFrame} style={btnStyle()}>&#x23EA;</button>
      <button onClick={togglePlay} style={btnStyle(isPlaying)}>
        {isPlaying ? '\u23F8' : '\u25B6'}
      </button>
      <button onClick={nextFrame} style={btnStyle()}>&#x23E9;</button>
      <button onClick={goEnd} style={btnStyle()}>&#x23ED;</button>

      <span style={{ color: theme.colors.text.primary, fontSize: theme.fontSize.sm,
        fontFamily: 'monospace', margin: '0 6px', minWidth: 70, textAlign: 'center' }}>
        {frameToTime(currentFrame, fps)}
      </span>

      <div style={{ width: 1, height: 20, background: theme.colors.border.strong, margin: '0 4px' }} />

      <button onClick={handleSplit} style={btnStyle()}>&#x2702; Split</button>
      <button onClick={handleRippleDelete} style={btnStyle()}>Ripple</button>
      <button onClick={handleDelete} style={btnStyle()}>&#x1F5D1;</button>
      <button onClick={() => setSnapEnabled(!snapEnabled)} style={btnStyle(snapEnabled)}>
        &#x1F9F2; Snap
      </button>

      <div style={{ width: 1, height: 20, background: theme.colors.border.strong, margin: '0 4px' }} />

      <button onClick={undo} disabled={!canUndo()} style={{...btnStyle(), opacity: canUndo() ? 1 : 0.4}}>&#x21A9;</button>
      <button onClick={redo} disabled={!canRedo()} style={{...btnStyle(), opacity: canRedo() ? 1 : 0.4}}>&#x21AA;</button>

      <div style={{ width: 1, height: 20, background: theme.colors.border.strong, margin: '0 4px' }} />

      <button onClick={() => addTrack('video')} style={btnStyle()}>+V</button>
      <button onClick={() => addTrack('audio')} style={btnStyle()}>+A</button>
      <button onClick={() => addTrack('text')} style={btnStyle()}>+T</button>
      <button onClick={addTestClip} style={btnStyle()}>&#x1F3AC; Test</button>
    </div>
  );
};