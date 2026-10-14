import { useCallback, useEffect, useRef, useState } from "react";
import usePrefersReducedMotion from "./usePrefersReducedMotion";

const NAV_DURATION = 900;
const SWIPE_THRESHOLD = 50;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/*
  Continuous, slowly drifting carousel shared by the scooter lineup and reviews.

  `position` is a float measured in cards; it keeps increasing forever, so the
  loop never jumps. A single requestAnimationFrame loop advances it and writes
  each slide's offset straight to the DOM (CSS variables), so React only
  re-renders when the nearest card changes — not every frame.

  Per slide it sets:
    --offset  slide position relative to the current position (in cards)
    --focus   1 when the slide is exactly at the current position, 0 one card away

  - Drift: `speed` cards per second. Slows on mouse hover, stops for keyboard
    focus, while off screen, in a hidden tab, and with reduced motion.
  - Arrows / dots / clicks: glide to a whole card, then drift eases back in.
  - Swipe: the track follows the finger, then glides to the next card.
*/
export default function useDriftCarousel({ count, speed }) {
  const reducedMotion = usePrefersReducedMotion();
  const viewportRef = useRef(null);
  const slidesRef = useRef(new Map());
  const positionRef = useRef(0);
  const motion = useRef({
    velocity: 0,
    tween: null,
    hovered: false,
    focused: false,
    drag: null,
    inView: false,
    pageVisible: true,
    reducedMotion,
  });
  const suppressClickRef = useRef(false);
  // Restarts the animation loop after it has gone to sleep (set by the loop effect).
  const wakeRef = useRef(() => {});
  const [base, setBase] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    motion.current.reducedMotion = reducedMotion;
    wakeRef.current();
  }, [reducedMotion]);

  const applySlide = (virtualIndex, element) => {
    const offset = virtualIndex - positionRef.current;
    const focus = Math.max(0, 1 - Math.abs(offset));
    element.style.setProperty("--offset", offset.toFixed(4));
    element.style.setProperty("--focus", focus.toFixed(3));
    element.style.zIndex = String(1 + Math.round(focus * 10));
  };

  // Ref callback: positions a slide before its first paint (no flicker on mount).
  const registerSlide = useCallback(
    (virtualIndex) => (element) => {
      if (element) {
        slidesRef.current.set(virtualIndex, element);
        applySlide(virtualIndex, element);
      } else {
        slidesRef.current.delete(virtualIndex);
      }
    },
    [],
  );

  const glideTo = useCallback((target) => {
    const state = motion.current;
    state.tween = {
      from: positionRef.current,
      to: target,
      start: performance.now(),
      duration: state.reducedMotion ? 0 : NAV_DURATION,
    };
    wakeRef.current();
  }, []);

  // Rapid clicks accumulate from the pending target instead of the current spot.
  const step = useCallback(
    (direction) => {
      const pending = motion.current.tween?.to ?? Math.round(positionRef.current);
      glideTo(pending + direction);
    },
    [glideTo],
  );

  const goTo = useCallback(
    (index) => {
      const nearest = Math.round(positionRef.current);
      const current = ((nearest % count) + count) % count;
      let delta = (((index - current) % count) + count) % count;
      if (delta > count / 2) delta -= count;
      glideTo(nearest + delta);
    },
    [count, glideTo],
  );

  const goToVirtual = useCallback((virtualIndex) => glideTo(virtualIndex), [glideTo]);

  // Animation loop. It sleeps (no frames at all) while nothing moves — e.g. the
  // carousel is off screen or the tab is hidden — and wakes on any change.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now) => {
      frame = 0;
      const state = motion.current;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const before = positionRef.current;

      if (state.drag) {
        // Position is driven by the pointer (see onPointerMove).
      } else if (state.tween) {
        const { from, to, start, duration } = state.tween;
        const t = duration ? Math.min((now - start) / duration, 1) : 1;
        positionRef.current = from + (to - from) * easeInOutCubic(t);
        if (t >= 1) {
          state.tween = null;
          state.velocity = 0; // drift eases back in from rest
        }
      } else {
        const drifting = !state.reducedMotion && !state.focused && state.inView && state.pageVisible;
        const targetVelocity = drifting ? speed * (state.hovered ? 0.3 : 1) : 0;
        state.velocity += (targetVelocity - state.velocity) * Math.min(1, dt * 2.5);
        if (targetVelocity === 0 && Math.abs(state.velocity) < 1e-4) state.velocity = 0;
        positionRef.current += state.velocity * dt;
      }

      if (positionRef.current !== before) {
        slidesRef.current.forEach((element, virtualIndex) => applySlide(virtualIndex, element));
        const nearest = Math.round(positionRef.current);
        setBase((current) => (current === nearest ? current : nearest));
      }
      const idle = !state.drag && !state.tween && state.velocity === 0 &&
        (state.reducedMotion || state.focused || !state.inView || !state.pageVisible);
      if (!idle) frame = requestAnimationFrame(tick);
    };

    wakeRef.current = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    wakeRef.current();
    return () => {
      cancelAnimationFrame(frame);
      wakeRef.current = () => {};
    };
  }, [speed]);

  // Only drift while visible on screen and while the tab is visible.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        motion.current.inView = entry.isIntersecting;
        wakeRef.current();
      },
      { threshold: 0.1 },
    );
    observer.observe(viewport);
    const onVisibility = () => {
      motion.current.pageVisible = document.visibilityState === "visible";
      wakeRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* ---------- Swipe ---------- */

  const slotWidth = () => {
    const nearest = Math.round(positionRef.current);
    const a = slidesRef.current.get(nearest);
    const b = slidesRef.current.get(nearest + 1);
    if (a && b) return Math.abs(b.getBoundingClientRect().left - a.getBoundingClientRect().left) || 1;
    return viewportRef.current?.offsetWidth || 1;
  };

  const endDrag = (event) => {
    const state = motion.current;
    const drag = state.drag;
    if (!drag || drag.id !== event.pointerId) {
      if (drag?.pending?.id === event.pointerId) state.drag = null;
      return;
    }
    state.drag = null;
    setDragging(false);
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 350);
    const dx = event.clientX - drag.startX;
    const target =
      Math.abs(dx) > SWIPE_THRESHOLD
        ? Math.round(drag.startPosition) + (dx < 0 ? 1 : -1)
        : Math.round(positionRef.current);
    glideTo(target);
  };

  const shellProps = {
    onPointerEnter: (event) => {
      if (event.pointerType === "mouse") motion.current.hovered = true;
      wakeRef.current();
    },
    onPointerLeave: (event) => {
      if (event.pointerType === "mouse") motion.current.hovered = false;
      wakeRef.current();
    },
    // Keyboard users get a still carousel while tabbing through it.
    onFocus: (event) => {
      if (event.target.matches(":focus-visible")) motion.current.focused = true;
      wakeRef.current();
    },
    onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) motion.current.focused = false;
      wakeRef.current();
    },
  };

  const viewportProps = {
    ref: viewportRef,
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") return;
      motion.current.drag = {
        pending: { id: event.pointerId, startX: event.clientX, startY: event.clientY },
      };
    },
    onPointerMove: (event) => {
      const state = motion.current;
      const drag = state.drag;
      if (!drag) return;

      if (drag.pending) {
        const { id, startX, startY } = drag.pending;
        if (id !== event.pointerId) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          state.drag = null; // vertical scroll — let the page handle it
          return;
        }
        state.tween = null;
        state.velocity = 0;
        state.drag = { id, startX, startPosition: positionRef.current, slot: slotWidth() };
        wakeRef.current();
        setDragging(true);
      }

      const active = state.drag;
      if (active.id !== event.pointerId) return;
      positionRef.current = active.startPosition - (event.clientX - active.startX) / active.slot;
      slidesRef.current.forEach((element, virtualIndex) => applySlide(virtualIndex, element));
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onClickCapture: (event) => {
      if (suppressClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }
    },
  };

  return {
    base,
    dragging,
    registerSlide,
    next: () => step(1),
    previous: () => step(-1),
    goTo,
    goToVirtual,
    shellProps,
    viewportProps,
  };
}
