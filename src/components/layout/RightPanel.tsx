import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { UpdateClipCommand } from '../../stores/commands/UpdateClipCommand';
import { theme } from '../../styles/theme';

export function RightPanel() {
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const clips = useEditorStore((s) => s.clips);
  const dispatch = useEditorStore((s) => s.dispatch);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);

  const sc = clips.find((c) => c.id === selectedClipIds[0]);

  const update = (key: string, value: number | string | boolean) => {
    if (!sc) return;
    dispatch(new UpdateClipCommand(sc.id, { [key]: value }));
  };

  const numField = (label: string, key: string, val: number, opts?: { min?: number; max?: number; step?: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
      <span style={{ width: 50, fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>{label}</span>
      <input type="number" value={val}
        min={opts?.min} max={opts?.max} step={opts?.step || 1}
        onChange={(e) => update(key, Number(e.target.value))}
        style={{
          flex: 1, padding: '3px 6px', fontSize: theme.fontSize.sm,
          background: theme.colors.bg.elevated, color: theme.colors.text.primary,
          border: `1px solid ${theme.colors.border.default}`, borderRadius: theme.radius.sm,
          outline: 'none',
        }}
      />
    </div>
  );

  if (!sc) {
    return (
      <div style={{ padding: theme.spacing.lg, color: theme.colors.text.muted, fontSize: theme.fontSize.sm }}>
        <div style={{ fontSize: theme.fontSize.lg, fontWeight: 600, marginBottom: 16, color: theme.colors.text.primary }}>
          {'\uC18D\uC131'}
        </div>
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          {'\uD074\uB9BD\uC744 \uC120\uD0DD\uD558\uBA74 \uC18D\uC131\uC744 \uD3B8\uC9D1\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4'}
        </div>
      </div>
    );
  }

  const typeColor = sc.type === 'video' ? theme.colors.track.video
    : sc.type === 'audio' ? theme.colors.track.audio
    : sc.type === 'text' ? theme.colors.track.text
    : theme.colors.accent.purple;

  return (
    <div style={{ padding: theme.spacing.lg, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: theme.fontSize.lg, fontWeight: 600, marginBottom: 8, color: theme.colors.text.primary }}>
        {'\uC18D\uC131'}
      </div>

      {/* Clip name */}
      <div style={{ color: typeColor, fontSize: theme.fontSize.md, fontWeight: 600, marginBottom: 4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sc.name}
      </div>
      <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.text.muted, marginBottom: 12 }}>
        {'\uD0C0\uC785: '}{sc.type} | ID: {sc.id.slice(0, 8)}
      </div>

      {/* Timeline */}
      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.colors.text.secondary, marginBottom: 6 }}>
        {'\uD0C0\uC784\uB77C\uC778'}
      </div>
      {numField('\uC2DC\uC791', 'startFrame', sc.startFrame, { min: 0 })}
      {numField('\uAE38\uC774', 'durationFrames', sc.durationFrames, { min: 1 })}
      {numField('\uC18D\uB3C4', 'speed', sc.speed, { min: 0.25, max: 4, step: 0.25 })}

      {/* Position/Size */}
      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.colors.text.secondary, marginTop: 12, marginBottom: 6 }}>
        {'\uC704\uCE58/\uD06C\uAE30'}
      </div>
      {numField('X', 'x', sc.x)}
      {numField('Y', 'y', sc.y)}
      {numField('\uB108\uBE44', 'width', sc.width, { min: 10 })}
      {numField('\uB192\uC774', 'height', sc.height, { min: 10 })}
      {numField('\uD68C\uC804', 'rotation', sc.rotation, { min: -360, max: 360 })}

      {/* Style */}
      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.colors.text.secondary, marginTop: 12, marginBottom: 6 }}>
        {'\uC2A4\uD0C0\uC77C'}
      </div>
      {numField('\uBD88\uD22C\uBA85', 'opacity', sc.opacity, { min: 0, max: 100 })}
      {numField('\uBC1D\uAE30', 'brightness', sc.brightness, { min: -100, max: 100 })}
      {numField('\uB300\uBE44', 'contrast', sc.contrast, { min: 0, max: 200 })}
      {numField('\uCC44\uB3C4', 'saturation', sc.saturation, { min: 0, max: 200 })}

      {/* Audio */}
      {(sc.type === 'video' || sc.type === 'audio') && (
        <>
          <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.colors.text.secondary, marginTop: 12, marginBottom: 6 }}>
            {'\uC624\uB514\uC624'}
          </div>
          {numField('\uBCFC\uB968', 'volume', sc.volume, { min: 0, max: 200 })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ width: 50, fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>{'\uBBA4\uD2B8'}</span>
            <input type="checkbox" checked={sc.muted} onChange={(e) => update('muted', e.target.checked)} />
          </div>
        </>
      )}

      {/* Fade */}
      <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.colors.text.secondary, marginTop: 12, marginBottom: 6 }}>
        {'\uD398\uC774\uB4DC'}
      </div>
      {numField('Fade In', 'fadeIn', sc.fadeIn, { min: 0 })}
      {numField('Fade Out', 'fadeOut', sc.fadeOut, { min: 0 })}

      {/* Text-specific */}
      {sc.type === 'text' && (
        <>
          <div style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.colors.text.secondary, marginTop: 12, marginBottom: 6 }}>
            {'\uD14D\uC2A4\uD2B8'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ width: 50, fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>{'\uB0B4\uC6A9'}</span>
            <input type="text" value={sc.text || ''} onChange={(e) => update('text', e.target.value)}
              style={{
                flex: 1, padding: '3px 6px', fontSize: theme.fontSize.sm,
                background: theme.colors.bg.elevated, color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border.default}`, borderRadius: theme.radius.sm,
                outline: 'none',
              }} />
          </div>
          {numField('\uAE00\uC790\uD06C\uAE30', 'fontSize', sc.fontSize || 48, { min: 8, max: 200 })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ width: 50, fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>{'\uC0C9\uC0C1'}</span>
            <input type="color" value={sc.fontColor || '#ffffff'} onChange={(e) => update('fontColor', e.target.value)}
              style={{ width: 32, height: 24, border: 'none', background: 'none', cursor: 'pointer' }} />
          </div>
        </>
      )}

      {/* Footer info */}
      <div style={{ marginTop: 20, paddingTop: 12, borderTop: `1px solid ${theme.colors.border.subtle}`,
        display: 'flex', justifyContent: 'space-between', fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>
        <span>Undo: {canUndo() ? 'Y' : 'N'}</span>
        <span>Redo: {canRedo() ? 'Y' : 'N'}</span>
      </div>
    </div>
  );
}