/**
 * createDragHandler - 범용 드래그 유틸리티
 * wavesurfer.js의 createDragStream 패턴 기반
 *
 * 핵심: pointerdown을 받으면 document 레벨에서 pointermove/pointerup을 추적
 * → SVG viewBox 좌표 문제, 이벤트 버블링 충돌이 구조적으로 불가능
 */

export interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
}

export interface DragCallbacks {
  onStart?: (state: DragState, e: PointerEvent) => void;
  onMove?: (state: DragState, e: PointerEvent) => void;
  onEnd?: (state: DragState, e: PointerEvent) => void;
}

/**
 * 특정 HTMLElement에 드래그 기능을 부착합니다.
 * @param element - 드래그 시작을 감지할 요소
 * @param callbacks - onStart, onMove, onEnd 콜백
 * @param threshold - 드래그 시작 최소 이동 거리 (기본 2px)
 * @returns cleanup 함수
 */
export function attachDragHandler(
  element: HTMLElement,
  callbacks: DragCallbacks,
  threshold = 2
): () => void {
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return; // 좌클릭만

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;
    let prevX = startX;
    let prevY = startY;

    const onPointerMove = (me: PointerEvent) => {
      const dx = me.clientX - prevX;
      const dy = me.clientY - prevY;
      const totalDx = me.clientX - startX;
      const totalDy = me.clientY - startY;

      if (!isDragging) {
        if (Math.abs(totalDx) < threshold && Math.abs(totalDy) < threshold) return;
        isDragging = true;
        callbacks.onStart?.({
          startX, startY,
          currentX: me.clientX, currentY: me.clientY,
          deltaX: totalDx, deltaY: totalDy
        }, me);
      }

      callbacks.onMove?.({
        startX, startY,
        currentX: me.clientX, currentY: me.clientY,
        deltaX: dx, deltaY: dy
      }, me);

      prevX = me.clientX;
      prevY = me.clientY;
    };

    const onPointerUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);

      if (isDragging) {
        callbacks.onEnd?.({
          startX, startY,
          currentX: ue.clientX, currentY: ue.clientY,
          deltaX: ue.clientX - prevX, deltaY: ue.clientY - prevY
        }, ue);
      }
    };

    // document 레벨에서 추적 → SVG 경계 문제 원천 차단
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  };

  element.addEventListener('pointerdown', onPointerDown);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
  };
}

/**
 * React에서 ref 콜백으로 사용하는 버전
 * 사용법: <div ref={useDragRef({ onStart, onMove, onEnd })} />
 */
export function createDragRef(callbacks: DragCallbacks, threshold = 2) {
  let cleanup: (() => void) | null = null;

  return (element: HTMLElement | null) => {
    cleanup?.();
    cleanup = null;
    if (element) {
      cleanup = attachDragHandler(element, callbacks, threshold);
    }
  };
}