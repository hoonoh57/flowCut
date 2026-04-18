import React from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { frameToTime } from '../../utils/timeFormat';
import { theme } from '../../styles/theme';

interface RulerProps {
  totalWidth: number;
}

export const Ruler: React.FC<RulerProps> = ({ totalWidth }) => {
  const zoom = useEditorStore((s) => s.zoomLevel);
  const fps = useEditorStore((s) => s.fps);
  const pxPerSec = 100 * zoom;
  const totalSec = Math.ceil(totalWidth / pxPerSec) + 2;
  const marks: { x: number; label: string; major: boolean }[] = [];
  for (let s = 0; s <= totalSec; s++) {
    marks.push({ x: s * pxPerSec, label: frameToTime(s * fps, fps), major: s % 5 === 0 });
    for (let sub = 1; sub < 4; sub++) {
      marks.push({ x: (s + sub / 4) * pxPerSec, label: '', major: false });
    }
  }
  return (
    <div style={{ position: 'relative', width: totalWidth, height: '100%', pointerEvents: 'none' }}>
      {marks.map((m, i) => (
        <div key={i} style={{ position: 'absolute', left: m.x, top: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 1, height: m.major ? 14 : m.label ? 10 : 6, background: m.major ? theme.colors.text.secondary : theme.colors.border.strong }} />
          {m.label && m.major && (
            <span style={{ fontSize: 9, color: theme.colors.text.muted, marginTop: 1, whiteSpace: 'nowrap', userSelect: 'none' }}>{m.label}</span>
          )}
        </div>
      ))}
    </div>
  );
};