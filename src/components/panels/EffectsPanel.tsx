import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { UpdateClipCommand } from '../../stores/commands/UpdateClipCommand';
import { theme } from '../../styles/theme';
import type { ClipNumericKey } from '../../types/clip';
import { getClipNumericValue } from '../../types/clip';

const EFFECTS = [
  { name: '흑백', apply: { saturation: 0 } },
  { name: '세피아', apply: { saturation: 30, brightness: -10 } },
  { name: '빈티지', apply: { contrast: 130, saturation: 60, brightness: -5 } },
  { name: '고대비', apply: { contrast: 150, brightness: 10 } },
  { name: '밝게', apply: { brightness: 30, contrast: 110 } },
  { name: '어둡게', apply: { brightness: -30, contrast: 120 } },
  { name: '블러 (강)', apply: { blur: 10 } },
  { name: '블러 (약)', apply: { blur: 3 } },
  { name: '네온', apply: { saturation: 150, brightness: 20, contrast: 120 } },
  { name: '워터컬러', apply: { saturation: 80, brightness: 5, contrast: 90 } },
  { name: '리셋', apply: { brightness: 0, contrast: 100, saturation: 100, blur: 0 } },
];


// Audio Effect Presets (A-series)
const AUDIO_EFFECTS = [
  { id: 'A01', name: 'A01 Fade In', desc: 'Smooth volume fade in', icon: '🔊', apply: { fadeIn: 30 } },
  { id: 'A02', name: 'A02 Fade Out', desc: 'Smooth volume fade out', icon: '🔉', apply: { fadeOut: 30 } },
  { id: 'A03', name: 'A03 Fade Both', desc: 'Fade in + out', icon: '🔈', apply: { fadeIn: 20, fadeOut: 20 } },
  { id: 'A04', name: 'A04 Mute', desc: 'Silence clip', icon: '🔇', apply: { muted: true } },
  { id: 'A05', name: 'A05 Half Volume', desc: 'Reduce to 50%', icon: '🔉', apply: { volume: 50 } },
  { id: 'A06', name: 'A06 Boost', desc: 'Amplify to 150%', icon: '🔊', apply: { volume: 150 } },
  { id: 'A07', name: 'A07 Max Boost', desc: 'Amplify to 200%', icon: '💥', apply: { volume: 200 } },
  { id: 'A08', name: 'A08 Slow', desc: 'Playback 0.5x', icon: '🐢', apply: { speed: 0.5 } },
  { id: 'A09', name: 'A09 Fast', desc: 'Playback 2x', icon: '⚡', apply: { speed: 2 } },
  { id: 'A10', name: 'A10 Dramatic', desc: 'Low start, peak middle', icon: '🎭', apply: {
    volumeEnvelope: [
      { position: 0, volume: 20 },
      { position: 0.3, volume: 100 },
      { position: 0.7, volume: 150 },
      { position: 1, volume: 30 },
    ]
  }},
  { id: 'A11', name: 'A11 Swell', desc: 'Gradually build up', icon: '🌊', apply: {
    volumeEnvelope: [
      { position: 0, volume: 10 },
      { position: 0.5, volume: 60 },
      { position: 0.85, volume: 150 },
      { position: 1, volume: 100 },
    ]
  }},
  { id: 'A12', name: 'A12 Dip', desc: 'Quiet middle section', icon: '🕳️', apply: {
    volumeEnvelope: [
      { position: 0, volume: 100 },
      { position: 0.35, volume: 20 },
      { position: 0.65, volume: 20 },
      { position: 1, volume: 100 },
    ]
  }},
  { id: 'A13', name: 'A13 Pulse', desc: 'Rhythmic volume', icon: '💓', apply: {
    volumeEnvelope: [
      { position: 0, volume: 100 },
      { position: 0.15, volume: 30 },
      { position: 0.3, volume: 100 },
      { position: 0.45, volume: 30 },
      { position: 0.6, volume: 100 },
      { position: 0.75, volume: 30 },
      { position: 0.9, volume: 100 },
      { position: 1, volume: 60 },
    ]
  }},
];

export const EffectsPanel: React.FC = () => {
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const clips = useEditorStore((s) => s.clips);
  const dispatch = useEditorStore((s) => s.dispatch);

  const selectedClip = clips.find(c => c.id === selectedClipIds[0]);

  const applyEffect = (effect: typeof EFFECTS[0]) => {
    if (!selectedClip) return;
    dispatch(new UpdateClipCommand(selectedClip.id, effect.apply));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!selectedClip && (
        <div style={{ color: theme.colors.text.muted, fontSize: theme.fontSize.sm, textAlign: 'center', paddingTop: 30 }}>
          {'클립을 선택하면 효과를 적용할 수 있습니다'}
        </div>
      )}
      {selectedClip && (
        <>
          <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text.secondary }}>
            {'선택: '}{selectedClip.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {EFFECTS.map((eff, i) => (
              <button
                key={i}
                onClick={() => applyEffect(eff)}
                style={{
                  padding: '12px 8px', borderRadius: theme.radius.sm,
                  background: theme.colors.bg.elevated,
                  border: `1px solid ${theme.colors.border.subtle}`,
                  cursor: 'pointer', color: theme.colors.text.primary,
                  fontSize: theme.fontSize.sm, fontWeight: 500,
                }}
              >
                {eff.name}
              </button>
            ))}
          </div>

          {/* Manual sliders */}
          <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text.secondary, marginTop: 8, fontWeight: 600 }}>
            {'수동 조절'}
          </div>
          {[
            { key: 'brightness', label: '밝기', min: -100, max: 100 },
            { key: 'contrast', label: '대비', min: 0, max: 200 },
            { key: 'saturation', label: '채도', min: 0, max: 200 },
            { key: 'blur', label: '블러', min: 0, max: 20 },
            { key: 'opacity', label: '투명도', min: 0, max: 100 },
          ].map(({ key, label, min, max }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 50, fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>{label}</span>
              <input
                type="range" min={min} max={max}
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
