import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { Clip, VolumePoint } from '../../types/clip';
import { useEditorStore } from '../../stores/editorStore';
import { UpdateClipCommand } from '../../stores/commands/UpdateClipCommand';

interface Props {
  clip: Clip;
  width: number;
  height: number;
  top: number;
}

const SNAP_DIST = 0.03;

export const ClipEnvelope: React.FC<Props> = React.memo(({ clip, width, height, top }) => {
  const dispatch = useEditorStore(s => s.dispatch);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [dragIndicator, setDragIndicator] = useState<{x: number; y: number; vol: number} | null>(null);

  const envelope = useMemo(() => {
    if (clip.volumeEnvelope && clip.volumeEnvelope.length >= 2) {
      return [...clip.volumeEnvelope].sort((a, b) => a.position - b.position);
    }
    const vol = clip.volume ?? 100;
    return [{ position: 0, volume: vol }, { position: 1, volume: vol }];
  }, [clip.volumeEnvelope, clip.volume]);

  const posToX = useCallback((pos: number) => pos * width, [width]);
  const volToY = useCallback((vol: number) => height - (vol / 200) * height, [height]);
  const xToPos = useCallback((x: number) => Math.max(0, Math.min(1, x / width)), [width]);
  const yToVol = useCallback((y: number) => Math.max(0, Math.min(200, ((height - y) / height) * 200)), [height]);

  const updateEnvelope = useCallback((newEnv: VolumePoint[]) => {
    dispatch(new UpdateClipCommand(clip.id, { volumeEnvelope: newEnv }));
  }, [dispatch, clip.id]);

  // 더블클릭: 편집 모드 토글
  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditMode(prev => !prev);
    setDragIndicator(null);
  }, []);

  // ESC 또는 외부 클릭: 편집 모드 해제
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setEditMode(false); setDragIndicator(null); }
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditMode(false);
        setDragIndicator(null);
      }
    };
    window.addEventListener('keydown', onKey);
    // 약간 지연시켜서 현재 더블클릭 이벤트가 끝난 후 등록
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', onClick, true);
    }, 100);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick, true);
      clearTimeout(timer);
    };
  }, [editMode]);

  // 포인터 다운: document 레벨 드래그
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const clickPos = xToPos(clickX);
    const clickVol = yToVol(clickY);

    let nearIdx = -1;
    let nearDist = Infinity;
    envelope.forEach((pt, i) => {
      const dist = Math.abs(pt.position - clickPos);
      if (dist < nearDist) { nearDist = dist; nearIdx = i; }
    });

    let targetIdx: number;
    let newEnv = [...envelope];
    if (nearDist > SNAP_DIST) {
      const newPoint: VolumePoint = { position: clickPos, volume: clickVol };
      newEnv.push(newPoint);
      newEnv.sort((a, b) => a.position - b.position);
      targetIdx = newEnv.findIndex(p => p.position === clickPos && p.volume === clickVol);
    } else {
      targetIdx = nearIdx;
    }

    const isEdge = targetIdx === 0 || targetIdx === newEnv.length - 1;

    setDragIndicator({
      x: posToX(newEnv[targetIdx].position),
      y: volToY(newEnv[targetIdx].volume),
      vol: newEnv[targetIdx].volume
    });

    let currentEnv = [...newEnv];

    const onMove = (me: PointerEvent) => {
      const mx = me.clientX - rect.left;
      const my = me.clientY - rect.top;
      const newVol = yToVol(my);
      let newPos = xToPos(mx);

      if (isEdge) {
        newPos = currentEnv[targetIdx].position;
      } else {
        const prev = currentEnv[targetIdx - 1];
        const next = currentEnv[targetIdx + 1];
        if (prev) newPos = Math.max(prev.position + 0.005, newPos);
        if (next) newPos = Math.min(next.position - 0.005, newPos);
      }

      currentEnv[targetIdx] = { position: newPos, volume: newVol };
      setDragIndicator({ x: posToX(newPos), y: volToY(newVol), vol: newVol });
      dispatch(new UpdateClipCommand(clip.id, { volumeEnvelope: [...currentEnv] }));
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      updateEnvelope([...currentEnv]);
      setTimeout(() => setDragIndicator(null), 400);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [editMode, envelope, xToPos, yToVol, posToX, volToY, dispatch, clip.id, updateEnvelope]);

  // 우클릭: 포인트 삭제
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickPos = xToPos(e.clientX - rect.left);

    let nearIdx = -1;
    let nearDist = Infinity;
    envelope.forEach((pt, i) => {
      if (i === 0 || i === envelope.length - 1) return;
      const dist = Math.abs(pt.position - clickPos);
      if (dist < nearDist) { nearDist = dist; nearIdx = i; }
    });

    if (nearIdx > 0 && nearDist < SNAP_DIST * 2) {
      const newEnv = envelope.filter((_, i) => i !== nearIdx);
      updateEnvelope(newEnv);
    }
  }, [editMode, envelope, xToPos, updateEnvelope]);

  // SVG 경로
  const linePath = useMemo(() => {
    return envelope.map(pt => `${posToX(pt.position)},${volToY(pt.volume)}`).join(' ');
  }, [envelope, posToX, volToY]);

  const fillPath = useMemo(() => {
    const top2 = envelope.map(pt => `${posToX(pt.position)},${volToY(pt.volume)}`).join(' ');
    return `0,${height} ${top2} ${width},${height}`;
  }, [envelope, posToX, volToY, width, height]);

  const envColor = editMode ? '#ef4444' : '#f59e0b';
  const fillColor = editMode ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)';

  return (
    <div
      ref={containerRef}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      style={{
        position: 'absolute',
        top, left: 0,
        width, height,
        cursor: editMode ? 'ns-resize' : 'default',
        zIndex: editMode ? 20 : 5,
        touchAction: 'none',
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <polygon points={fillPath} fill={fillColor} />
        <polyline
          points={linePath}
          stroke={envColor}
          strokeWidth={editMode ? 2.5 : 1.5}
          fill="none"
          strokeLinejoin="round"
        />

        {editMode && envelope.map((pt, i) => {
          const cx = posToX(pt.position);
          const cy = volToY(pt.volume);
          return (
            <g key={i}>
              <line x1={cx-5} y1={cy-5} x2={cx+5} y2={cy+5} stroke={envColor} strokeWidth={2} />
              <line x1={cx+5} y1={cy-5} x2={cx-5} y2={cy+5} stroke={envColor} strokeWidth={2} />
              <line x1={cx} y1={cy-6} x2={cx} y2={cy+6} stroke={envColor} strokeWidth={2} />
              <line x1={cx-6} y1={cy} x2={cx+6} y2={cy} stroke={envColor} strokeWidth={2} />
            </g>
          );
        })}

        {dragIndicator && (
          <>
            <line
              x1={dragIndicator.x} y1={0}
              x2={dragIndicator.x} y2={height}
              stroke={envColor} strokeWidth={1} strokeDasharray="3,3" opacity={0.5}
            />
            <line x1={dragIndicator.x-8} y1={dragIndicator.y-8} x2={dragIndicator.x+8} y2={dragIndicator.y+8} stroke="#fff" strokeWidth={3} />
            <line x1={dragIndicator.x+8} y1={dragIndicator.y-8} x2={dragIndicator.x-8} y2={dragIndicator.y+8} stroke="#fff" strokeWidth={3} />
            <line x1={dragIndicator.x} y1={dragIndicator.y-10} x2={dragIndicator.x} y2={dragIndicator.y+10} stroke="#fff" strokeWidth={3} />
            <line x1={dragIndicator.x-10} y1={dragIndicator.y} x2={dragIndicator.x+10} y2={dragIndicator.y} stroke="#fff" strokeWidth={3} />
            <line x1={dragIndicator.x-7} y1={dragIndicator.y-7} x2={dragIndicator.x+7} y2={dragIndicator.y+7} stroke={envColor} strokeWidth={1.5} />
            <line x1={dragIndicator.x+7} y1={dragIndicator.y-7} x2={dragIndicator.x-7} y2={dragIndicator.y+7} stroke={envColor} strokeWidth={1.5} />
            <line x1={dragIndicator.x} y1={dragIndicator.y-9} x2={dragIndicator.x} y2={dragIndicator.y+9} stroke={envColor} strokeWidth={1.5} />
            <line x1={dragIndicator.x-9} y1={dragIndicator.y} x2={dragIndicator.x+9} y2={dragIndicator.y} stroke={envColor} strokeWidth={1.5} />
          </>
        )}
      </svg>

      {dragIndicator && (
        <div style={{
          position: 'absolute',
          left: Math.min(dragIndicator.x + 14, width - 50),
          top: dragIndicator.y - 10,
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 30,
        }}>
          {Math.round(dragIndicator.vol)}%
        </div>
      )}

      {editMode && (
        <div style={{
          position: 'absolute',
          top: 2, right: 4,
          background: 'rgba(239,68,68,0.9)',
          color: '#fff',
          padding: '1px 5px',
          borderRadius: 3,
          fontSize: 9,
          fontWeight: 700,
          pointerEvents: 'none',
        }}>
          LEVEL EDIT
        </div>
      )}
    </div>
  );
});

ClipEnvelope.displayName = 'ClipEnvelope';
export default ClipEnvelope;