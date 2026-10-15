import { useCallback, useEffect, useRef, useState } from "react";

const MIN = 1;
const MAX = 3;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/*
  Zoom & pan for a photo stage (no dependencies).
  - Wheel / trackpad pinch, two-finger pinch, double-click/tap, +/- buttons, keyboard
  - Drag (mouse, pen or one finger) to pan while zoomed; at 1× one-finger
    drags scroll the page as normal
  - Pan is clamped so the photo always covers the stage
  Writes --zoom-s / --zoom-x / --zoom-y on the layer element (transform only).
*/
export default function useZoomPan({ resetKey } = {}) {
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const view = useRef({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(0);
  const [scale, setScale] = useState(1);

  const apply = useCallback((next) => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return;
    const { width, height } = stage.getBoundingClientRect();
    const s = clamp(next.s, MIN, MAX);
    // Keep the photo covering the stage: max offset = (s - 1) * size / 2
    const maxX = ((s - 1) * width) / 2;
    const maxY = ((s - 1) * height) / 2;
    view.current = { s, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
    layer.style.setProperty("--zoom-s", view.current.s.toFixed(4));
    layer.style.setProperty("--zoom-x", `${view.current.x.toFixed(1)}px`);
    layer.style.setProperty("--zoom-y", `${view.current.y.toFixed(1)}px`);
    setScale((current) => (Math.abs(current - s) > 0.01 ? s : current));
  }, []);

  // Zoom keeping the point under (cx, cy) — stage coordinates from centre — still.
  const zoomAt = useCallback(
    (factor, cx = 0, cy = 0) => {
      const { s, x, y } = view.current;
      const nextS = clamp(s * factor, MIN, MAX);
      const k = nextS / s;
      apply({ s: nextS, x: cx - (cx - x) * k, y: cy - (cy - y) * k });
    },
    [apply],
  );

  const reset = useCallback(() => apply({ s: 1, x: 0, y: 0 }), [apply]);

  const fromCentre = (event) => {
    const rect = stageRef.current.getBoundingClientRect();
    return [event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2];
  };

  // New colour / view: start from the full photo.
  useEffect(() => {
    reset();
  }, [resetKey, reset]);

  // Wheel must be non-passive to stop the page scrolling while zooming.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event) => {
      // Plain wheel scrolls the page at 1×; ctrl/trackpad-pinch or a zoomed photo zooms.
      if (view.current.s === 1 && !event.ctrlKey) return;
      event.preventDefault();
      const [cx, cy] = fromCentre(event);
      zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025)), cx, cy);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (event) => {
    if (event.button > 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { type: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), start: { ...view.current } };
    } else if (view.current.s > 1 || event.pointerType !== "touch") {
      gesture.current = { type: "pan", px: event.clientX, py: event.clientY, start: { ...view.current } };
    }
    if (gesture.current) event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = stageRef.current.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - rect.left - rect.width / 2;
      const cy = (a.y + b.y) / 2 - rect.top - rect.height / 2;
      const nextS = clamp((g.start.s * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist, MIN, MAX);
      const k = nextS / g.start.s;
      apply({ s: nextS, x: cx - (cx - g.start.x) * k, y: cy - (cy - g.start.y) * k });
    } else if (g.type === "pan" && view.current.s > 1) {
      apply({ s: g.start.s, x: g.start.x + event.clientX - g.px, y: g.start.y + event.clientY - g.py });
    }
  };

  const onPointerUp = (event) => {
    // Only gestures that started on the photo count (not clicks on the zoom buttons).
    if (!pointers.current.has(event.pointerId)) return;
    const moved = gesture.current?.type === "pan" && Math.hypot(event.clientX - gesture.current.px, event.clientY - gesture.current.py) > 6;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2 && gesture.current?.type === "pinch") gesture.current = null;
    if (pointers.current.size === 0) {
      gesture.current = null;
      // Double-tap / double-click toggles 2× at that point.
      const now = performance.now();
      if (!moved && now - lastTap.current < 300) {
        lastTap.current = 0;
        if (view.current.s > 1) reset();
        else {
          const [cx, cy] = fromCentre(event);
          zoomAt(2, cx, cy);
        }
      } else if (!moved) {
        lastTap.current = now;
      }
    }
  };

  const onKeyDown = (event) => {
    const step = 60;
    const actions = {
      "+": () => zoomAt(1.4),
      "=": () => zoomAt(1.4),
      "-": () => zoomAt(1 / 1.4),
      0: reset,
      ArrowLeft: () => apply({ ...view.current, x: view.current.x + step }),
      ArrowRight: () => apply({ ...view.current, x: view.current.x - step }),
      ArrowUp: () => apply({ ...view.current, y: view.current.y + step }),
      ArrowDown: () => apply({ ...view.current, y: view.current.y - step }),
    };
    const action = actions[event.key];
    if (!action || (event.key.startsWith("Arrow") && view.current.s === 1)) return;
    event.preventDefault();
    action();
  };

  return {
    scale,
    stageRef,
    layerRef,
    zoomIn: () => zoomAt(1.4),
    zoomOut: () => zoomAt(1 / 1.4),
    reset,
    stageProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  };
}
