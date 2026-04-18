import React, { useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { theme } from '../../styles/theme';

const AI_FEATURES = [
  { id: 'auto-cut', icon: '✂️', name: '자동 컷', desc: '무음 구간을 자동으로 제거합니다' },
  { id: 'auto-subtitle', icon: '📝', name: '자동 자막', desc: '음성을 인식하여 자막을 생성합니다' },
  { id: 'smart-resize', icon: '📰', name: '스마트 리사이즈', desc: '주요 피사체를 유지하며 비율을 변경합니다' },
  { id: 'color-match', icon: '🎨', name: '색상 매칭', desc: '클립 간 색상을 자동 매칭합니다' },
  { id: 'bg-remove', icon: '✨', name: '배경 제거', desc: 'AI로 배경을 자동 제거합니다' },
  { id: 'music-gen', icon: '🎵', name: '배경음악 생성', desc: '영상에 맞는 배경음악을 생성합니다' },
];

export const AIPanel: React.FC = () => {
  const [processing, setProcessing] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const addExportLog = useEditorStore((s) => s.addExportLog);

  const runAI = async (featureId: string) => {
    const feature = AI_FEATURES.find(f => f.id === featureId);
    if (!feature) return;
    setProcessing(featureId);
    const msg = `[AI] ${feature.name} 처리 중...`;
    setLog(prev => [...prev, msg]);
    addExportLog(msg);

    // Simulate AI processing
    await new Promise(r => setTimeout(r, 2000));

    const done = `[AI] ${feature.name} 완료 (데모 - 실제 API 연동 필요)`;
    setLog(prev => [...prev, done]);
    addExportLog(done);
    setProcessing(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.text.muted, padding: '4px 0' }}>
        AI 기능은 데모 모드입니다. 실제 사용을 위해서는 AI API 연동이 필요합니다.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {AI_FEATURES.map((f) => (
          <button
            key={f.id}
            onClick={() => runAI(f.id)}
            disabled={processing !== null}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px',
              borderRadius: theme.radius.md,
              background: processing === f.id ? theme.colors.accent.blue + '22' : theme.colors.bg.elevated,
              border: `1px solid ${processing === f.id ? theme.colors.accent.blue : theme.colors.border.subtle}`,
              cursor: processing ? 'wait' : 'pointer', textAlign: 'left',
              opacity: processing && processing !== f.id ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text.primary, fontWeight: 600 }}>
                {f.name}
                {processing === f.id && <span style={{ marginLeft: 6, fontSize: 10, color: theme.colors.accent.blue }}>{'처리중...'}</span>}
              </div>
              <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.text.muted, marginTop: 2 }}>
                {f.desc}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div style={{
          marginTop: 8, padding: 8, borderRadius: theme.radius.sm,
          background: theme.colors.bg.tertiary, maxHeight: 120, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 9, color: theme.colors.text.muted, marginBottom: 4 }}>Log</div>
          {log.map((l, i) => (
            <div key={i} style={{ fontSize: 10, color: theme.colors.text.secondary, lineHeight: 1.5 }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
};
// HMR-TRIGGER: 2026-04-18 08:19:14
