import { useEffect } from "react";

/*
  Reveals any element marked with `data-reveal` when it scrolls into view.
  Mount once (in App). New elements — route changes, quiz results — are picked
  up automatically. Content is only hidden once this hook has started
  (`reveal-ready` on <html>), so without JS everything stays visible.
*/
export default function useScrollReveal() {
  useEffect(() => {
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const root = document.documentElement;
    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          // An attribute (not a class) so React re-renders never wipe it.
          entry.target.setAttribute("data-revealed", "");
          intersection.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    const observeWithin = (node) => {
      if (!(node instanceof Element)) return;
      if (node.matches("[data-reveal]:not([data-revealed])")) intersection.observe(node);
      node.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((element) => {
        intersection.observe(element);
      });
    };

    const mutations = new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach(observeWithin);
    });

    observeWithin(document.body);
    mutations.observe(document.body, { childList: true, subtree: true });
    root.classList.add("reveal-ready");

    return () => {
      intersection.disconnect();
      mutations.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);
}
