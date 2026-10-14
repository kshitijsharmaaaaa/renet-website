import { useEffect } from "react";

// Exposes scroll progress through the hero (0 → 1) as `--hero-progress`
// so CSS can drive a gentle parallax with transforms only.
export default function useHeroParallax(heroRef) {
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(Math.max(window.scrollY / (hero.offsetHeight || 1), 0), 1);
      hero.style.setProperty("--hero-progress", progress.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [heroRef]);
}
