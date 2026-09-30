'use client';
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';

type View = { xStart: number; xEnd: number; yStart: number; yEnd: number };
type Bounds = { start: number; end: number; ceiling: number };
type Point = { x: number; y: number };
type SavedView = View & { key: string };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function plotArea(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const left = rect.left + 64, right = rect.right - 24;
  const top = rect.top + 22, bottom = rect.bottom - 38;
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function pointAt(element: HTMLElement, clientX: number, clientY: number): Point {
  const area = plotArea(element);
  return {
    x: clamp((clientX - area.left) / area.width, 0, 1),
    y: clamp((area.top + area.height - clientY) / area.height, 0, 1),
  };
}

function zoomView(view: View, factor: number, from: Point, to: Point, bounds: Bounds): View {
  const xSpan = clamp((view.xEnd - view.xStart) * factor, Math.max(15 * 60_000, (bounds.end - bounds.start) / 128), bounds.end - bounds.start);
  const ySpan = clamp((view.yEnd - view.yStart) * factor, Math.max(1, bounds.ceiling / 128), bounds.ceiling);
  const xStart = clamp(view.xStart + (view.xEnd - view.xStart) * from.x - xSpan * to.x, bounds.start, bounds.end - xSpan);
  const yStart = clamp(view.yStart + (view.yEnd - view.yStart) * from.y - ySpan * to.y, 0, bounds.ceiling - ySpan);
  return { xStart, xEnd: xStart + xSpan, yStart, yEnd: yStart + ySpan };
}

function panView(view: View, dx: number, dy: number, area: ReturnType<typeof plotArea>, bounds: Bounds): View {
  const xSpan = view.xEnd - view.xStart, ySpan = view.yEnd - view.yStart;
  const xStart = clamp(view.xStart - dx / area.width * xSpan, bounds.start, bounds.end - xSpan);
  const yStart = clamp(view.yStart + dy / area.height * ySpan, 0, bounds.ceiling - ySpan);
  return { xStart, xEnd: xStart + xSpan, yStart, yEnd: yStart + ySpan };
}

export function useChartZoom(bounds: Bounds, mode: string, enabled: boolean) {
  const { start, end, ceiling } = bounds;
  const chartRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<SavedView | null>(null);
  const key = `${mode}:${bounds.start}:${bounds.end}:${bounds.ceiling}`;
  const full: View = { xStart: bounds.start, xEnd: bounds.end, yStart: 0, yEnd: bounds.ceiling };
  const zoomed = saved?.key === key;
  const view: View = zoomed ? saved : full;
  const latestView = useRef(view);
  const mouseDrag = useRef<{ x: number; y: number; view: View } | null>(null);
  useEffect(() => { latestView.current = view; }, [view]);

  const save = useCallback((next: View) => {
    const isFull = Math.abs(next.xStart - bounds.start) < 1 && Math.abs(next.xEnd - bounds.end) < 1
      && Math.abs(next.yStart) < .001 && Math.abs(next.yEnd - bounds.ceiling) < .001;
    latestView.current = next;
    setSaved(isFull ? null : { ...next, key });
  }, [bounds.start, bounds.end, bounds.ceiling, key]);

  const zoomBy = (factor: number) => save(zoomView(latestView.current, factor, { x: .5, y: 0 }, { x: .5, y: 0 }, bounds));
  const reset = () => { latestView.current = full; setSaved(null); };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !enabled) return;
    const limits = { start, end, ceiling };
    let pinch: { distance: number; view: View; center: Point } | null = null;
    let touchDrag: { x: number; y: number; view: View; active: boolean } | null = null;
    const touchCenter = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });
    const touchDistance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      const center = pointAt(chart, event.clientX, event.clientY);
      const factor = Math.exp(clamp(event.deltaY, -250, 250) * .0025);
      const before = latestView.current;
      const next = zoomView(before, factor, center, center, limits);
      if (Math.abs(next.xStart - before.xStart) < 1 && Math.abs(next.xEnd - before.xEnd) < 1
        && Math.abs(next.yStart - before.yStart) < .001 && Math.abs(next.yEnd - before.yEnd) < .001) return;
      event.preventDefault();
      save(next);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        const center = touchCenter(event.touches);
        pinch = { distance: Math.max(1, touchDistance(event.touches)), view: latestView.current, center: pointAt(chart, center.x, center.y) };
        touchDrag = null;
      } else if (event.touches.length === 1 && (latestView.current.xEnd - latestView.current.xStart < end - start - 1
        || latestView.current.yEnd - latestView.current.yStart < ceiling - .001)) {
        touchDrag = { x: event.touches[0].clientX, y: event.touches[0].clientY, view: latestView.current, active: false };
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        if (!pinch) onTouchStart(event);
        if (!pinch) return;
        const center = touchCenter(event.touches);
        save(zoomView(pinch.view, pinch.distance / Math.max(1, touchDistance(event.touches)), pinch.center, pointAt(chart, center.x, center.y), limits));
      } else if (event.touches.length === 1 && touchDrag) {
        const dx = event.touches[0].clientX - touchDrag.x, dy = event.touches[0].clientY - touchDrag.y;
        if (!touchDrag.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) touchDrag.active = true;
        if (touchDrag.active) {
          event.preventDefault();
          save(panView(touchDrag.view, dx, 0, plotArea(chart), limits));
        }
      }
    };
    const onTouchEnd = () => { pinch = null; touchDrag = null; };
    chart.addEventListener('wheel', onWheel, { passive: false });
    chart.addEventListener('touchstart', onTouchStart, { passive: true });
    chart.addEventListener('touchmove', onTouchMove, { passive: false });
    chart.addEventListener('touchend', onTouchEnd);
    chart.addEventListener('touchcancel', onTouchEnd);
    return () => {
      chart.removeEventListener('wheel', onWheel);
      chart.removeEventListener('touchstart', onTouchStart);
      chart.removeEventListener('touchmove', onTouchMove);
      chart.removeEventListener('touchend', onTouchEnd);
      chart.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [start, end, ceiling, enabled, save]);

  const onMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!zoomed || event.button !== 0) return;
    mouseDrag.current = { x: event.clientX, y: event.clientY, view: latestView.current };
    event.currentTarget.classList.add('dragging');
    event.preventDefault();
  };
  const onMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!mouseDrag.current || !chartRef.current) return;
    const drag = mouseDrag.current;
    save(panView(drag.view, event.clientX - drag.x, event.clientY - drag.y, plotArea(chartRef.current), bounds));
  };
  const onMouseUp = (event: ReactMouseEvent<HTMLDivElement>) => {
    mouseDrag.current = null;
    event.currentTarget.classList.remove('dragging');
  };

  return { chartRef: chartRef as RefObject<HTMLDivElement>, view, zoomed, zoomBy, reset, onMouseDown, onMouseMove, onMouseUp };
}
