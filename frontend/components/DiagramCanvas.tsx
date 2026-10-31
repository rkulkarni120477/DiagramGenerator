"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

interface Props {
  children: ReactNode;
  /** Changing this value resets zoom and pan. */
  resetKey: string;
}

const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

export function DiagramCanvas({ children, resetKey }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [resetKey]);

  // Wheel zoom needs a non-passive listener so the page does not scroll while zooming.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setScale((current) => clamp(current * (event.deltaY < 0 ? 1.1 : 0.9)));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    setOffset({
      x: start.originX + event.clientX - start.x,
      y: start.originY + event.clientY - start.y,
    });
  };

  const endDrag = () => {
    dragStart.current = null;
    setDragging(false);
  };

  // Fit the diagram into the viewport, but never enlarge it past 100%.
  const fit = () => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const contentWidth = content.scrollWidth;
    const contentHeight = content.scrollHeight;
    if (!contentWidth || !contentHeight) return;
    const fitScale = Math.min(
      viewport.clientWidth / contentWidth,
      viewport.clientHeight / contentHeight,
      1,
    );
    setScale(clamp(fitScale * 0.95));
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="canvas-wrapper">
      <div className="canvas-controls" role="toolbar" aria-label="Zoom controls">
        <button type="button" onClick={() => setScale((s) => clamp(s * 0.8))} aria-label="Zoom out">
          −
        </button>
        <span className="zoom-level" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <button type="button" onClick={() => setScale((s) => clamp(s * 1.25))} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={fit}>
          Fit
        </button>
        <button
          type="button"
          onClick={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          100%
        </button>
      </div>
      <div
        ref={viewportRef}
        className={`canvas ${dragging ? "dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="canvas-content"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          <div ref={contentRef} className="canvas-inner">
            {children}
          </div>
        </div>
      </div>
      <p className="canvas-hint muted small">Scroll to zoom. Drag to pan.</p>
    </div>
  );
}
