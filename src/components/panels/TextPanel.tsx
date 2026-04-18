import React, { useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { createTextClip } from '../../utils/clipFactory';
import { AddClipCommand } from '../../stores/commands/AddClipCommand';
import { uid } from '../../utils/uid';
import { theme } from '../../styles/theme';



const PRESETS = [
  { label: '기본 텍스트', fontSize: 48, fontColor: '#ffffff', fontFamily: 'sans-serif' },
  { label: '제목 (큰 글자)', fontSize: 72, fontColor: '#ffffff', fontFamily: 'sans-serif' },
  { label: '자막', fontSize: 32, fontColor: '#ffff00', fontFamily: 'sans-serif' },
  { label: '손글씨', fontSize: 40, fontColor: '#ffffff', fontFamily: 'cursive' },
  { label: '네온 텍스트', fontSize: 56, fontColor: '#00ffff', fontFamily: 'monospace' },
  { label: '그라데이션', fontSize: 48, fontColor: '#ff6b6b', fontFamily: 'serif' },
];

export const TextPanel: React.FC = () => {
  const dispatch = useEditorStore((s) => s.dispatch);
  const tracks = useEditorStore((s) => s.tracks);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const fps = useEditorStore((s) => s.fps);

  const [customText, setCustomText] = useState('');

  const addTextClip = (preset: typeof PRESETS[0], text?: string) => {
    let tTrack = tracks.find(t => t.type === 'text');
    if (!tTrack) tTrack = tracks.find(t => t.type === 'video');
    if (!tTrack) return;

    const clip = createTextClip(
      tTrack.id, currentFrame, fps,
      text || preset.label,
      { fontSize: preset.fontSize, fontColor: preset.fontColor, fontFamily: preset.fontFamily }
    );
    dispatch(new AddClipCommand(clip));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Custom text input */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={'텍스트 입력...'}
          style={{
            flex: 1, padding: '8px', borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.border.default}`,
            background: theme.colors.bg.elevated, color: theme.colors.text.primary,
            fontSize: theme.fontSize.md, outline: 'none',
          }}
        />
        <button
          onClick={() => { if (customText.trim()) { addTextClip(PRESETS[0], customText.trim()); setCustomText(''); } }}
          style={{
            padding: '8px 12px', borderRadius: theme.radius.sm,
            background: theme.colors.accent.blue, color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: theme.fontSize.sm, fontWeight: 600,
          }}
        >
          {'추가'}
        </button>
      </div>

      {/* Preset grid */}
      <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, fontWeight: 600 }}>
        {'프리셋'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => addTextClip(p)}
            style={{
              padding: '16px 8px', borderRadius: theme.radius.md,
              background: theme.colors.bg.elevated,
              border: `1px solid ${theme.colors.border.subtle}`,
              cursor: 'pointer', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{
              fontSize: Math.min(p.fontSize / 3, 20), fontFamily: p.fontFamily,
              color: p.fontColor, textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}>
              {p.label}
            </span>
            <span style={{ fontSize: 9, color: theme.colors.text.muted }}>
              {p.fontSize}px · {p.fontFamily}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
// HMR-TRIGGER: 2026-04-18 08:19:14
