import { useRef } from "react";
import { Link } from "react-router-dom";
import products from "../data/products";
import { enquiryLink } from "../lib/enquiry";
import useHeroParallax from "../hooks/useHeroParallax";
import { responsiveImage } from "../lib/images";

const MODELS = ["d8-white", "d8-black"];

// Cinematic homepage hero built on the RENET lineup photograph.
export default function HomeHero() {
  const heroRef = useRef(null);
  const enquiry = enquiryLink();

  useHeroParallax(heroRef);

  return (
    <section className="hm-hero" id="home" ref={heroRef}>
      <div className="hm-hero-media" aria-hidden="true">
        <img {...responsiveImage("/renet-hero.png", "100vw")} alt="" fetchPriority="high" decoding="async" />
      </div>

      <div className="hm-hero-copy">
        <p className="hm-eyebrow hm-enter" style={{ "--enter-delay": "0.2s" }}>
          <span className="hm-dot" /> THE NEW WAY TO MOVE · RENET D-8
        </p>

        <h1 className="hm-hero-title">
          <span className="hm-line">A little less</span>{" "}
          <span className="hm-line hm-line-accent">ordinary.</span>
        </h1>

        <p className="hm-hero-text hm-enter" style={{ "--enter-delay": "0.7s" }}>
          Your everyday journey deserves something different. Step into a new era of electric
          mobility with RENET.
        </p>

        <div className="hm-cta-row hm-enter" style={{ "--enter-delay": "0.85s" }}>
          <a className="rn-btn rn-btn-primary" href="#models">
            Explore models <span aria-hidden="true">↓</span>
          </a>
          <a className="rn-btn rn-btn-ghost" {...enquiry.linkProps}>
            Enquire now <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="hm-showcase hm-enter" style={{ "--enter-delay": "1.05s" }}>
          {MODELS.map((slug) => (
            <Link key={slug} to={`/scooters/${slug}`} className="hm-showcase-link">
              Explore the {products[slug].name} <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
