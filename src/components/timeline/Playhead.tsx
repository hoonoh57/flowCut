import React, { useCallback, useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { theme } from '../../styles/theme';

const TRACK_HEIGHT = 60;

interface PlayheadProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const Playhead: React.FC<PlayheadProps> = ({ containerRef }) => {
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const fps = useEditorStore((s) => s.fps);
  const zoom = useEditorStore((s) => s.zoomLevel);
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const tracks = useEditorStore((s) => s.tracks);
  const dragging = useRef(false);

  const pxPerFrame = (100 * zoom) / fps;
  const x = currentFrame * pxPerFrame;
  const totalH = tracks.length * TRACK_HEIGHT;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    setIsPlaying(false);
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const px = ev.clientX - rect.left + (containerRef.current.scrollLeft ?? 0);
      const frame = Math.max(0, Math.round(px / pxPerFrame));
      setCurrentFrame(frame);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pxPerFrame, containerRef, setCurrentFrame, setIsPlaying]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: x - 7,
        top: 0,
        width: 14,
        height: totalH,
        cursor: 'col-resize',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div style={{
        width: 2,
        height: '100%',
        background: theme.colors.accent.red,
        pointerEvents: 'none',
      }} />
    </div>
  );
};