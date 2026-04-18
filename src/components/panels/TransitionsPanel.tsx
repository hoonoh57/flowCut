import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { UpdateClipCommand } from '../../stores/commands/UpdateClipCommand';
import { theme } from '../../styles/theme';
import type { ClipNumericKey } from '../../types/clip';
import { getClipNumericValue } from '../../types/clip';

const TRANSITIONS = [
  { name: '페이드 인', icon: '▶', fadeIn: 15, fadeOut: 0 },
  { name: '페이드 아웃', icon: '◀', fadeIn: 0, fadeOut: 15 },
  { name: '페이드 인/아웃', icon: '▶◀', fadeIn: 15, fadeOut: 15 },
  { name: '빠른 페이드', icon: '⚡', fadeIn: 5, fadeOut: 5 },
  { name: '느린 페이드', icon: '🐢', fadeIn: 30, fadeOut: 30 },
  { name: '페이드 제거', icon: '✖', fadeIn: 0, fadeOut: 0 },
];

export const TransitionsPanel: React.FC = () => {
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const clips = useEditorStore((s) => s.clips);
  const dispatch = useEditorStore((s) => s.dispatch);
  const fps = useEditorStore((s) => s.fps);

  const selectedClip = clips.find(c => c.id === selectedClipIds[0]);

  const applyTransition = (t: typeof TRANSITIONS[0]) => {
    if (!selectedClip) return;
    dispatch(new UpdateClipCommand(selectedClip.id, {
      fadeIn: t.fadeIn,
      fadeOut: t.fadeOut,
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!selectedClip ? (
        <div style={{ color: theme.colors.text.muted, fontSize: theme.fontSize.sm, textAlign: 'center', paddingTop: 30 }}>
          {'클립을 선택한 후 전환 효과를 적용하세요'}
        </div>
      ) : (
        <>
          <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text.secondary }}>
            {'선택: '}{selectedClip.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TRANSITIONS.map((t, i) => (
              <button
                key={i}
                onClick={() => applyTransition(t)}
                style={{
                  padding: '14px 8px', borderRadius: theme.radius.md,
                  background: theme.colors.bg.elevated,
                  border: `1px solid ${theme.colors.border.subtle}`,
                  cursor: 'pointer', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ fontSize: theme.fontSize.xs, color: theme.colors.text.primary }}>{t.name}</span>
                <span style={{ fontSize: 9, color: theme.colors.text.muted }}>
                  {t.fadeIn > 0 ? `In ${t.fadeIn}f` : ''} {t.fadeOut > 0 ? `Out ${t.fadeOut}f` : ''}
                  {t.fadeIn === 0 && t.fadeOut === 0 ? 'None' : ''}
                </span>
              </button>
            ))}
          </div>

          {/* Manual fade controls */}
          <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, marginTop: 8, fontWeight: 600 }}>
            {'수동 조절 (프레임)'}
          </div>
          {[
            { key: 'fadeIn', label: 'Fade In', max: Math.floor(selectedClip.durationFrames / 2) },
            { key: 'fadeOut', label: 'Fade Out', max: Math.floor(selectedClip.durationFrames / 2) },
          ].map(({ key, label, max }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 60, fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>{label}</span>
              <input
                type="range" min={0} max={max}
                value={getClipNumericValue(selectedClip, key as ClipNumericKey)}
                onChange={(e) => dispatch(new UpdateClipCommand(selectedClip.id, { [key]: Number(e.target.value) }))}
                style={{ flex: 1 }}
              />
              <span style={{ width: 30, fontSize: theme.fontSize.xs, color: theme.colors.text.secondary, textAlign: 'right' }}>
                {getClipNumericValue(selectedClip, key as ClipNumericKey)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
// HMR-TRIGGER: 2026-04-18 08:19:14
