import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { createTextClipFromPreset } from '../../utils/clipFactory';
import { AddClipCommand } from '../../stores/commands/AddClipCommand';
import { theme } from '../../styles/theme';
import {
  PRESET_CATEGORIES,
  getPresetsByCategory,
  getAllPresets,
  type PresetCategory,
  type TextPreset,
} from '../../presets/textPresets';
import {
  generateTextViaLLM,
  checkOllamaHealth,
  type AITextResult,
} from '../../presets/aiTextBridge';
import {
  analyzeAndPlan,
  executeComfyWorkflow,
  renderInfographic,
  type CreativePlan,
} from '../../presets/aiCreativeDirector';

export const TextPanel: React.FC = () => {
  const dispatch = useEditorStore((s) => s.dispatch);
  const tracks = useEditorStore((s) => s.tracks);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const fps = useEditorStore((s) => s.fps);

  const [customText, setCustomText] = useState('');
  const [activeCategory, setActiveCategory] = useState<PresetCategory | 'ai'>('basic');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AITextResult | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiError, setAiError] = useState('');
  const [creativePlan, setCreativePlan] = useState<CreativePlan | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  useEffect(() => {
    checkOllamaHealth().then(setAiAvailable).catch(() => setAiAvailable(false));
  }, []);

  const addTrack = useEditorStore((s) => s.addTrack);
  const addMediaItem = useEditorStore((s) => s.addMediaItem);

  const addPresetClip = (preset: TextPreset, text?: string) => {
    let tTrack = tracks.find(t => t.type === 'text');
    if (!tTrack) {
      const newTrack = {
        id: 't' + Date.now(),
        name: 'Text ' + (tracks.filter(t => t.type === 'text').length + 1),
        type: 'text' as const,
        order: 300,
        height: 40,
        color: '#f59e0b',
        locked: false,
        visible: true,
      };
      addTrack(newTrack);
      tTrack = newTrack;
    }
    const clip = createTextClipFromPreset(
      preset.id, tTrack.id, currentFrame, fps, text || undefined
    );
    dispatch(new AddClipCommand(clip));
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiProcessing(true);
    setAiError('');
    setAiResult(null);
    setCreativePlan(null);
    setExecutionLog([]);
    try {
      setExecutionLog(prev => [...prev, '🧠 AI가 요청을 분석 중...']);
      const plan = await analyzeAndPlan(aiPrompt);
      setCreativePlan(plan);
      setExecutionLog(prev => [...prev, '📋 계획: ' + plan.action, ...(plan.steps || []).map(s => '  → ' + s)]);

      // For text-only, also set aiResult for backward compat
      if (plan.text) {
        setAiResult({ text: plan.text, suggestedPreset: plan.presetId || 'basic-white' });
      }
    } catch (err: any) {
      setAiError(err.message || 'AI analysis failed');
    } finally {
      setAiProcessing(false);
    }
  };

  const executeCreativePlan = async () => {
    if (!creativePlan) return;
    setIsExecuting(true);
    setAiError('');
    try {
      const plan = creativePlan;

      if (plan.action === 'textOnly') {
        handleAIApply();
        setExecutionLog(prev => [...prev, '✅ 텍스트 클립 추가 완료']);
      }
      else if (plan.action === 'compositeLayout' && plan.layoutData) {
        setExecutionLog(prev => [...prev, '🎨 인포그래픽 렌더링 중...']);
        const canvas = renderInfographic(plan.layoutData, plan.width || 1920, plan.height || 1080);
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
        if (!blob) throw new Error('Canvas render failed');

        // Upload to server
        const formData = new FormData();
        formData.append('file', blob, 'infographic_' + Date.now() + '.png');
        const uploadResp = await fetch('http://localhost:3456/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadResp.json();

        if (uploadData.success) {
          setExecutionLog(prev => [...prev, '✅ 인포그래픽 생성 및 업로드 완료', '  📁 ' + uploadData.servePath]);
          // Could auto-add to timeline here
        }
      }
      else if (['generateImage', 'imageWithText'].includes(plan.action) && plan.workflow) {
        setExecutionLog(prev => [...prev, '🖼️ ComfyUI 이미지 생성 중... (' + plan.workflow + ')']);
        const result = await executeComfyWorkflow(plan.workflow, {
          positive: plan.comfyPrompt || plan.text || '',
          width: plan.width || 1280,
          height: plan.height || 720,
        });

        if (result.imageUrl) {
          setExecutionLog(prev => [...prev, '✅ 이미지 생성 완료']);

          // Download and upload to FlowCut server
          const imgResp = await fetch(result.imageUrl);
          const imgBlob = await imgResp.blob();
          const formData = new FormData();
          formData.append('file', imgBlob, 'ai_image_' + Date.now() + '.png');
          const uploadResp = await fetch('http://localhost:3456/api/upload', { method: 'POST', body: formData });
          const uploadData = await uploadResp.json();

          if (uploadData.success) {
            setExecutionLog(prev => [...prev, '📁 FlowCut에 업로드 완료: ' + uploadData.servePath]);
          }

          // If imageWithText, also add text clip
          if (plan.action === 'imageWithText' && plan.text) {
            handleAIApply();
            setExecutionLog(prev => [...prev, '✅ 텍스트 오버레이 추가 완료']);
          }
        }
      }
      else if (['generateVideo', 'videoWithText'].includes(plan.action)) {
        setExecutionLog(prev => [...prev, '🎬 영상 생성은 Wan2.2 워크플로우 필요 — 추후 지원 예정']);
        // Placeholder for Wan2.2 video generation
        if (plan.text) {
          handleAIApply();
        }
      }

      setExecutionLog(prev => [...prev, '🎉 작업 완료!']);
    } catch (err: any) {
      setAiError(err.message || 'Execution failed');
      setExecutionLog(prev => [...prev, '❌ 오류: ' + (err.message || 'unknown')]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleAIApply = () => {
    if (!aiResult) return;
    let tTrack = tracks.find(t => t.type === 'text');
    if (!tTrack) tTrack = tracks.find(t => t.type === 'video');
    if (!tTrack) return;
    const clip = createTextClipFromPreset(
      aiResult.suggestedPreset || 'basic-white',
      tTrack.id, currentFrame, fps, aiResult.text
    );
    dispatch(new AddClipCommand(clip));
    setAiResult(null);
    setAiPrompt('');
  };

  const getFilteredPresets = (category: PresetCategory): TextPreset[] => {
    const presets = getPresetsByCategory(category);
    if (!searchQuery.trim()) return presets;
    const q = searchQuery.toLowerCase();
    return presets.filter(p =>
      p.label.toLowerCase().includes(q) ||
      p.labelEn.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  };

  const cardStyle = (preset: TextPreset): React.CSSProperties => ({
    padding: '14px 10px', borderRadius: theme.radius.md,
    background: preset.previewBg || theme.colors.bg.elevated,
    border: '1px solid ' + theme.colors.border.subtle,
    cursor: 'pointer', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    transition: 'transform 0.1s, border-color 0.15s',
    minHeight: 80, justifyContent: 'center',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Custom text input */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={customText} onChange={(e) => setCustomText(e.target.value)}
          placeholder="텍스트 입력..."
          style={{ flex: 1, padding: '7px 8px', borderRadius: theme.radius.sm,
            border: '1px solid ' + theme.colors.border.default,
            background: theme.colors.bg.elevated, color: theme.colors.text.primary,
            fontSize: theme.fontSize.md, outline: 'none' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customText.trim()) {
              addPresetClip(getAllPresets()[0], customText.trim());
              setCustomText('');
            }
          }}
        />
        <button onClick={() => {
            if (customText.trim()) { addPresetClip(getAllPresets()[0], customText.trim()); setCustomText(''); }
          }}
          style={{ padding: '7px 14px', borderRadius: theme.radius.sm,
            background: theme.colors.accent.blue, color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: theme.fontSize.sm, fontWeight: 600 }}
        >추가</button>
      </div>

      {/* Search */}
      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="프리셋 검색..."
        style={{ padding: '5px 8px', borderRadius: theme.radius.sm,
          border: '1px solid ' + theme.colors.border.default,
          background: theme.colors.bg.elevated, color: theme.colors.text.primary,
          fontSize: theme.fontSize.sm, outline: 'none' }}
      />

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {PRESET_CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
            style={{ padding: '4px 8px', borderRadius: theme.radius.sm,
              border: '1px solid ' + (activeCategory === cat.key ? theme.colors.accent.blue : theme.colors.border.subtle),
              background: activeCategory === cat.key ? theme.colors.accent.blue + '22' : theme.colors.bg.elevated,
              color: activeCategory === cat.key ? theme.colors.accent.blue : theme.colors.text.secondary,
              cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
          >{cat.icon} {cat.label}</button>
        ))}
        <button onClick={() => setActiveCategory('ai')}
          style={{ padding: '4px 8px', borderRadius: theme.radius.sm,
            border: '1px solid ' + (activeCategory === 'ai' ? theme.colors.accent.purple : theme.colors.border.subtle),
            background: activeCategory === 'ai' ? theme.colors.accent.purple + '22' : theme.colors.bg.elevated,
            color: activeCategory === 'ai' ? theme.colors.accent.purple : theme.colors.text.secondary,
            cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
        >🤖 AI</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeCategory !== 'ai' ? (
          <>
            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.text.muted, marginBottom: 6, fontWeight: 600 }}>
              {PRESET_CATEGORIES.find(c => c.key === activeCategory)?.label || ''} 프리셋
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {getFilteredPresets(activeCategory as PresetCategory).map(preset => (
                <button key={preset.id}
                  onClick={() => addPresetClip(preset, customText.trim() || undefined)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = theme.colors.accent.blue;
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = theme.colors.border.subtle;
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                  style={cardStyle(preset)} title={preset.description}
                >
                  <span style={{
                    fontSize: Math.min(((preset.style.fontSize as number) || 48) / 3.5, 18),
                    fontFamily: (preset.style.fontFamily as string) || 'sans-serif',
                    fontWeight: (preset.style.fontWeight as string) || 'normal',
                    fontStyle: (preset.style.fontStyle as string) || 'normal',
                    color: preset.previewColor,
                    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                    lineHeight: 1.3, padding: '2px 6px', borderRadius: 3,
                    background: ((preset.style.textBgOpacity as number) || 0) > 0
                      ? (preset.style.textBgColor as string || '#000') + Math.round((((preset.style.textBgOpacity as number) || 0) / 100) * 255).toString(16).padStart(2, '0')
                      : 'transparent',
                    border: ((preset.style.borderWidth as number) || 0) > 0
                      ? '1px solid ' + (preset.style.borderColor || '#000')
                      : 'none',
                  }}>
                    {preset.label}
                  </span>
                  <span style={{ fontSize: 9, color: theme.colors.text.muted }}>
                    {preset.labelEn}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10, padding: '6px 8px', borderRadius: theme.radius.sm,
              background: aiAvailable ? theme.colors.accent.green + '15' : theme.colors.accent.red + '15',
              color: aiAvailable ? theme.colors.accent.green : theme.colors.accent.red,
              border: '1px solid ' + (aiAvailable ? theme.colors.accent.green + '33' : theme.colors.accent.red + '33') }}>
              {aiAvailable ? '✓ Ollama connected' : '✗ Ollama not detected — start: ollama serve'}
            </div>

            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={'AI에게 텍스트 생성 요청...\n예: 요리 영상 감성 제목'}
              rows={3}
              style={{ padding: 8, borderRadius: theme.radius.sm,
                border: '1px solid ' + theme.colors.border.default,
                background: theme.colors.bg.elevated, color: theme.colors.text.primary,
                fontSize: theme.fontSize.sm, outline: 'none', resize: 'vertical' }}
            />

            <button onClick={handleAIGenerate} disabled={aiProcessing || !aiPrompt.trim()}
              style={{ padding: '8px 12px', borderRadius: theme.radius.sm,
                background: aiProcessing ? theme.colors.bg.hover : theme.colors.accent.purple,
                color: '#fff', border: 'none',
                cursor: aiProcessing ? 'wait' : 'pointer',
                fontSize: theme.fontSize.sm, fontWeight: 600,
                opacity: (!aiPrompt.trim() || aiProcessing) ? 0.5 : 1 }}
            >{aiProcessing ? '생성 중...' : '🤖 AI 텍스트 생성'}</button>

            {aiError && <div style={{ fontSize: 10, color: theme.colors.accent.red }}>Error: {aiError}</div>}

            {aiResult && (
              <div style={{ padding: 10, borderRadius: theme.radius.md,
                background: theme.colors.bg.elevated,
                border: '1px solid ' + theme.colors.accent.purple + '33' }}>
                <div style={{ fontSize: 10, color: theme.colors.accent.purple, fontWeight: 600, marginBottom: 6 }}>
                  AI 생성 결과
                </div>
                <div style={{ fontSize: theme.fontSize.md, color: theme.colors.text.primary,
                  marginBottom: 8, padding: 8, background: theme.colors.bg.tertiary,
                  borderRadius: theme.radius.sm, lineHeight: 1.5 }}>
                  {aiResult.text}
                </div>
                <div style={{ fontSize: 10, color: theme.colors.text.muted, marginBottom: 8 }}>
                  추천: <strong style={{ color: theme.colors.accent.blue }}>{aiResult.suggestedPreset}</strong>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleAIApply}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: theme.radius.sm,
                      background: theme.colors.accent.blue, color: '#fff',
                      border: 'none', cursor: 'pointer', fontSize: theme.fontSize.sm, fontWeight: 600 }}
                  >타임라인에 추가</button>
                  <button onClick={() => setAiResult(null)}
                    style={{ padding: '6px 10px', borderRadius: theme.radius.sm,
                      background: theme.colors.bg.hover, color: theme.colors.text.secondary,
                      border: '1px solid ' + theme.colors.border.default,
                      cursor: 'pointer', fontSize: theme.fontSize.sm }}
                  >취소</button>
                </div>
              </div>
            )}

            {/* Creative Plan */}
            {creativePlan && creativePlan.action !== 'textOnly' && (
              <div style={{ padding: 10, borderRadius: theme.radius.md,
                background: theme.colors.bg.elevated,
                border: '1px solid ' + theme.colors.accent.green + '33' }}>
                <div style={{ fontSize: 10, color: theme.colors.accent.green, fontWeight: 600, marginBottom: 6 }}>
                  🎬 AI 제작 계획
                </div>
                <div style={{ fontSize: 11, color: theme.colors.text.primary, marginBottom: 4 }}>
                  액션: <strong>{creativePlan.action}</strong>
                  {creativePlan.workflow && <span> | 워크플로우: <strong>{creativePlan.workflow}</strong></span>}
                </div>
                {creativePlan.comfyPrompt && (
                  <div style={{ fontSize: 10, color: theme.colors.text.muted, marginBottom: 6, fontStyle: 'italic' }}>
                    ComfyUI: {creativePlan.comfyPrompt.substring(0, 80)}...
                  </div>
                )}
                <button onClick={executeCreativePlan} disabled={isExecuting}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: theme.radius.sm,
                    background: isExecuting ? theme.colors.bg.hover : theme.colors.accent.green,
                    color: '#fff', border: 'none',
                    cursor: isExecuting ? 'wait' : 'pointer',
                    fontSize: theme.fontSize.sm, fontWeight: 600,
                    opacity: isExecuting ? 0.6 : 1 }}
                >{isExecuting ? '⏳ 실행 중...' : '🚀 제작 실행'}</button>
              </div>
            )}

            {/* Execution Log */}
            {executionLog.length > 0 && (
              <div style={{ padding: 8, borderRadius: theme.radius.sm,
                background: theme.colors.bg.tertiary, maxHeight: 150, overflowY: 'auto' }}>
                {executionLog.map((log, i) => (
                  <div key={i} style={{
                    fontSize: 10, lineHeight: 1.6, fontFamily: 'monospace',
                    color: log.includes('✅') || log.includes('🎉') ? theme.colors.accent.green
                      : log.includes('❌') ? theme.colors.accent.red
                      : theme.colors.text.secondary
                  }}>{log}</div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 9, color: theme.colors.text.muted, lineHeight: 1.5, marginTop: 4 }}>
              LLM: ollama run gemma4:e4b | ComfyUI: 127.0.0.1:8188
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
