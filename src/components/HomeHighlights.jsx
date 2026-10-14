import { Link } from "react-router-dom";
import products from "../data/products";
import { enquiryLink } from "../lib/enquiry";
import { responsiveImage } from "../lib/images";

/*
  Editorial feature panels. Every statement here comes from information already
  published on the site (see src/data/products.js) — no performance claims.
*/
export default function HomeHighlights() {
  const white = products["d8-white"];
  const black = products["d8-black"];
  const enquiry = enquiryLink();

  const panels = [
    {
      tag: "Light signature",
      title: ["Single or double.", "Your signature."],
      copy: "The D-8 White wears a clean single-light front. The D-8 Black carries a bolder double-light face. Same D-8 — two distinct characters.",
      image: { src: "/renet-contact.png", focus: "25% 60%", alt: "RENET D-8 Black double-light front at night" },
      note: ["D-8 Black", "Double-light front"],
      actions: (
        <>
          <Link className="rn-chip" to="/scooters/d8-white">
            D-8 White · {white.light}
          </Link>
          <Link className="rn-chip" to="/scooters/d8-black">
            D-8 Black · {black.light}
          </Link>
        </>
      ),
    },
    {
      tag: "Design series",
      title: ["Two designs.", "One D-8."],
      copy: `${white.tagline} Or ${black.tagline.charAt(0).toLowerCase()}${black.tagline.slice(1)}`,
      image: { src: white.image, focus: "45% 55%", alt: "RENET D-8 White in the studio" },
      note: ["D-8 White", "Single light · Design series 01"],
      reverse: true,
      actions: (
        <>
          <Link className="rn-btn rn-btn-primary" to="/scooters/d8-white">
            Explore D-8 White <span aria-hidden="true">↗</span>
          </Link>
          <Link className="rn-btn rn-btn-ghost" to="/scooters/d8-black">
            Explore D-8 Black <span aria-hidden="true">↗</span>
          </Link>
        </>
      ),
    },
    {
      tag: "Confirmed, not guessed",
      title: ["Figures we'll", "stand behind."],
      copy: "Range, battery, charging time and warranty are being finalised. RENET publishes them only once they're officially confirmed — until then, the team will share the latest details with you directly.",
      image: { src: black.image, focus: "62% 60%", zoom: 1.6, alt: "RENET D-8 Black side detail" },
      note: ["Official data", "Awaiting confirmation"],
      actions: (
        <a className="rn-btn rn-btn-primary" {...enquiry.linkProps}>
          Ask the RENET team <span aria-hidden="true">↗</span>
        </a>
      ),
    },
  ];

  return (
    <section className="hm-highlights" id="highlights">
      <div className="hm-highlights-head">
        <div className="section-label" data-reveal>
          <span>03 / DESIGN HIGHLIGHTS</span>
          <span>THE DETAILS, UP CLOSE</span>
        </div>
        <h2 data-reveal>
          Made to be <span>noticed.</span>
        </h2>
      </div>

      {panels.map((panel) => (
        <article key={panel.tag} className={panel.reverse ? "hm-panel is-reverse" : "hm-panel"}>
          <div className="hm-panel-media" data-reveal="scale">
            <img
              {...responsiveImage(panel.image.src, `(max-width: 900px) ${Math.round(100 * (panel.image.zoom ?? 1))}vw, ${Math.round(55 * (panel.image.zoom ?? 1))}vw`)}
              alt={panel.image.alt}
              loading="lazy"
              decoding="async"
              style={{ "--focus": panel.image.focus, "--zoom": panel.image.zoom ?? 1 }}
            />
            <div className="hm-panel-note">
              <span>{panel.note[0]}</span>
              {panel.note[1]}
            </div>
          </div>

          <div className="hm-panel-copy" data-reveal style={{ "--reveal-delay": "120ms" }}>
            <span className="rn-tag">
              <span className="hm-dot" /> {panel.tag}
            </span>
            <h3>
              {panel.title[0]}
              <br />
              {panel.title[1]}
            </h3>
            <p>{panel.copy}</p>
            <div className="hm-panel-actions">{panel.actions}</div>
          </div>
        </article>
      ))}
    </section>
  );
}
