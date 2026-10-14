import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import products, { faqs, pendingSpecs, productOrder } from "./data/products";
import { ENQUIRY_EMAIL, emailUrl, enquiryLink } from "./lib/enquiry";
import useHeroParallax from "./hooks/useHeroParallax";
import { responsiveImage } from "./lib/images";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import LeadForm from "./components/LeadForm";
import "./ProductPage.css";

const PRODUCT_NAV = [
  { label: "All scooters", to: "/#models" },
  { label: "Gallery", to: "#gallery" },
  { label: "Design", to: "#features" },
  { label: "Specs", to: "#specs" },
  { label: "Performance", to: "#performance" },
  { label: "FAQ", to: "#faq" },
];

// Focal-point crop of a genuine photo: object-fit keeps proportions, zoom only crops.
// `vw` is the rendered width; zoomed crops request a proportionally larger file.
function ShotImage({ view, alt, className = "", loading, vw = 60 }) {
  const width = Math.round(vw * (view.zoom || 1));
  return (
    <img
      className={`pdp-shot ${className}`}
      {...responsiveImage(view.src, `(max-width: 1100px) ${Math.round(width * 1.6)}vw, ${width}vw`)}
      decoding="async"
      alt={alt}
      loading={loading}
      draggable="false"
      style={{ "--focus": view.focus, "--zoom": view.zoom }}
    />
  );
}

function FaqItem({ item, open, onToggle }) {
  const id = useId();
  return (
    <div className={open ? "pdp-faq-item is-open" : "pdp-faq-item"}>
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
        >
          <span>{item.question}</span>
          <span className="pdp-faq-icon" aria-hidden="true" />
        </button>
      </h3>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        className="pdp-faq-panel"
        inert={!open}
      >
        <div className="pdp-faq-inner">
          <p>{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { modelId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const heroRef = useRef(null);
  const [viewByModel, setViewByModel] = useState({});
  const [openFaq, setOpenFaq] = useState(0);
  const model = products[modelId];

  useHeroParallax(heroRef);

  // Scroll to top when arriving from another page — but not when switching
  // finish inside the gallery, which should keep the visitor where they are.
  useEffect(() => {
    if (!location.state?.keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
  }, [modelId, location.state]);

  if (!model) {
    return (
      <main className="product-not-found">
        <h1>Model not found.</h1>
        <Link to="/">Return to RENET home ↗</Link>
      </main>
    );
  }

  const enquiry = enquiryLink(model.name);
  const enquireLabel = enquiry.channel === "whatsapp" ? "Enquire on WhatsApp" : "Enquire now";
  const otherSlug = productOrder.find((slug) => slug !== modelId);
  const otherModel = products[otherSlug];
  const activeViewId = viewByModel[modelId] ?? model.gallery[0].id;
  const activeView = model.gallery.find((view) => view.id === activeViewId) ?? model.gallery[0];
  const finishIndex = productOrder.indexOf(modelId) + 1;

  const switchModel = (slug) => {
    if (slug !== modelId) navigate(`/scooters/${slug}`, { state: { keepScroll: true } });
  };

  // Every view of every model stays mounted so finish and view changes crossfade.
  const stageLayers = productOrder.flatMap((slug) =>
    products[slug].gallery.map((view) => ({ slug, view, key: `${slug}-${view.id}` })),
  );

  return (
    <main className={`pdp pdp-${model.color}`}>
      {/* SHARED HEADER — product sections + model-specific enquiry */}
      <SiteHeader links={PRODUCT_NAV} model={model.name} />

      {/* 1 — CINEMATIC HERO */}
      <section className="pdp-hero" ref={heroRef}>
        <div className="pdp-hero-media" aria-hidden="true">
          {productOrder.map((slug) => (
            <img
              key={slug}
              {...responsiveImage(products[slug].image, "(max-width: 760px) 100vw, 74vw")}
              alt=""
              loading={slug === modelId ? "eager" : "lazy"}
              className={slug === modelId ? "pdp-hero-image is-active" : "pdp-hero-image"}
              fetchPriority={slug === modelId ? "high" : "low"}
            />
          ))}
        </div>

        <div className="pdp-hero-copy">
          <p className="pdp-eyebrow pdp-enter" style={{ "--enter-delay": "0.15s" }}>
            <span className="pdp-dot" /> RENET D-8 · DESIGN SERIES {model.id}
          </p>

          <h1 key={modelId} className="pdp-hero-title">
            <span className="pdp-line">Meet the</span>{" "}
            <span className="pdp-line pdp-line-accent">{model.name}.</span>
          </h1>

          <p className="pdp-hero-tagline pdp-enter" style={{ "--enter-delay": "0.55s" }}>
            {model.tagline}
          </p>

          <div className="pdp-cta-row pdp-enter" style={{ "--enter-delay": "0.7s" }}>
            <a className="pdp-btn pdp-btn-primary" {...enquiry.linkProps}>
              {enquireLabel} <span aria-hidden="true">↗</span>
            </a>
            <a className="pdp-btn pdp-btn-ghost" href="#features">
              Explore features <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
      </section>

      {/* VERIFIED AT-A-GLANCE */}
      <section className="pdp-glance" aria-label="At a glance">
        {[
          ["D-8", "RENET model"],
          [model.light, "Light signature"],
          [model.shortName, "Selected design"],
          ["India", "Electric mobility"],
        ].map(([value, label], index) => (
          <div key={label} data-reveal style={{ "--reveal-delay": `${index * 80}ms` }}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      {/* 2 — GALLERY & FINISH */}
      <section className="pdp-section pdp-gallery" id="gallery">
        <div className="pdp-section-head" data-reveal>
          <p className="pdp-kicker">Gallery</p>
          <h2>
            Look closer at the <span>{model.name}.</span>
          </h2>
        </div>

        <div className="pdp-gallery-layout">
          <div className="pdp-gallery-main" data-reveal="scale">
            <div className="pdp-stage">
              {stageLayers.map(({ slug, view, key }) => (
                <ShotImage
                  key={key}
                  view={view}
                  alt={slug === modelId && view.id === activeView.id ? `${products[slug].name} — ${view.label}` : ""}
                  className={slug === modelId && view.id === activeView.id ? "is-active" : ""}
                  loading={slug === modelId ? "eager" : "lazy"}
                />
              ))}
              <span className="pdp-stage-label">
                {model.name} · {activeView.label}
              </span>
            </div>

            <div className="pdp-thumbs" role="group" aria-label="Gallery views">
              {model.gallery.map((view) => (
                <button
                  type="button"
                  key={view.id}
                  className={view.id === activeView.id ? "pdp-thumb is-active" : "pdp-thumb"}
                  aria-pressed={view.id === activeView.id}
                  onClick={() => setViewByModel((current) => ({ ...current, [modelId]: view.id }))}
                >
                  <span className="pdp-thumb-frame">
                    <ShotImage view={view} alt="" loading="lazy" vw={16} />
                  </span>
                  <span className="pdp-thumb-label">{view.label}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="pdp-finish" data-reveal style={{ "--reveal-delay": "120ms" }}>
            <p className="pdp-finish-index">
              Finish · 0{finishIndex} / 0{productOrder.length}
            </p>
            <h3>{model.name}</h3>
            <p className="pdp-finish-category">{model.category}</p>

            <div className="pdp-swatches" role="radiogroup" aria-label="Choose your design">
              {productOrder.map((slug) => (
                <button
                  type="button"
                  key={slug}
                  role="radio"
                  aria-checked={slug === modelId}
                  aria-label={products[slug].name}
                  className={slug === modelId ? "pdp-swatch is-active" : "pdp-swatch"}
                  style={{ "--swatch": products[slug].swatch }}
                  onClick={() => switchModel(slug)}
                />
              ))}
            </div>

            <p className="pdp-finish-copy">{model.description}</p>
            <p className="pdp-finish-note">Availability of each design is confirmed by RENET.</p>

            <a className="pdp-btn pdp-btn-dark" {...enquiry.linkProps}>
              Enquire about this design <span aria-hidden="true">↗</span>
            </a>
          </aside>
        </div>
      </section>

      {/* 3 — DESIGN HIGHLIGHTS */}
      <section className="pdp-section pdp-features" id="features">
        <div className="pdp-section-head" data-reveal>
          <p className="pdp-kicker">Design highlights</p>
          <h2>
            Your ride. <span>Your perspective.</span>
          </h2>
        </div>

        <div className="pdp-feature-grid">
          <article className="pdp-feature pdp-feature-light" data-reveal="scale">
            <div className="pdp-feature-media">
              <ShotImage view={model.lightView} alt={`${model.name} ${model.light.toLowerCase()} front`} loading="lazy" vw={55} />
            </div>
            <div className="pdp-feature-copy">
              <p className="pdp-kicker">Light signature</p>
              <h3>{model.light}.</h3>
              <p>{model.lightCopy}</p>
            </div>
          </article>

          <article className="pdp-feature pdp-feature-duo" data-reveal style={{ "--reveal-delay": "120ms" }}>
            <p className="pdp-kicker">Two characters</p>
            <h3>One D-8. Two ways to move.</h3>
            <ul>
              {productOrder.map((slug) => (
                <li key={slug} className={slug === modelId ? "is-current" : ""}>
                  <span className="pdp-mini-swatch" style={{ "--swatch": products[slug].swatch }} />
                  <span>
                    <strong>{products[slug].name}</strong>
                    {products[slug].tagline}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="pdp-values">
          {[
            ["01", "Thoughtful by design.", "Every detail begins with the people who will use it."],
            ["02", "Electric by nature.", "A new perspective on everyday electric mobility."],
            ["03", "Ready for what's next.", "Looking ahead while keeping the everyday in mind."],
          ].map(([index, title, copy], i) => (
            <div className="pdp-value" key={index} data-reveal style={{ "--reveal-delay": `${i * 100}ms` }}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — KEY SPECIFICATIONS (confirmed only) */}
      <section className="pdp-section pdp-specs" id="specs">
        <div className="pdp-specs-layout">
          <div className="pdp-section-head" data-reveal>
            <p className="pdp-kicker">Key specifications</p>
            <h2>
              What we can <span>confirm today.</span>
            </h2>
            <p className="pdp-section-sub">
              Only officially published information is listed. Technical figures appear below
              once RENET confirms them.
            </p>
          </div>

          <dl className="pdp-spec-list">
            {[
              ["Model", `RENET ${model.name}`],
              ["Type", "Electric scooter"],
              ["Light signature", model.light],
              ["Designs", "D-8 White · D-8 Black"],
              ["Market", "India"],
              ["Enquiries", ENQUIRY_EMAIL],
            ].map(([label, value], index) => (
              <div className="pdp-spec-row" key={label} data-reveal style={{ "--reveal-delay": `${index * 60}ms` }}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 5 — PERFORMANCE & BATTERY (pending official figures) */}
      <section className="pdp-section pdp-performance" id="performance">
        <div className="pdp-section-head" data-reveal>
          <p className="pdp-kicker">Performance & battery</p>
          <h2>
            Figures, confirmed — <span>not guessed.</span>
          </h2>
          <p className="pdp-section-sub">
            RENET is finalising official performance and battery figures for the D-8. They'll be
            published here once confirmed. Until then, the team will share the latest details on
            request.
          </p>
        </div>

        <div className="pdp-perf-card" data-reveal="scale">
          <div className="pdp-perf-ring" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" className="pdp-ring-track" />
              <circle cx="60" cy="60" r="52" className="pdp-ring-arc" />
            </svg>
            <div>
              <strong>D-8</strong>
              <span>Official data pending</span>
            </div>
          </div>

          <div className="pdp-perf-groups">
            {["Performance", "Energy", "Ownership"].map((group) => (
              <div className="pdp-perf-group" key={group}>
                <h3>{group}</h3>
                {pendingSpecs
                  .filter((spec) => spec.group === group)
                  .map((spec) => (
                    <div className="pdp-perf-row" key={spec.label}>
                      <span>{spec.label}</span>
                      <em>Awaiting official confirmation</em>
                    </div>
                  ))}
              </div>
            ))}
          </div>

          <div className="pdp-perf-foot">
            <p>No unverified performance figures are shown on this page.</p>
            <a className="pdp-btn pdp-btn-primary" {...enquiry.linkProps}>
              Ask for confirmed figures <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* THE OTHER DESIGN */}
      <section className="pdp-section pdp-other">
        <button
          type="button"
          className="pdp-other-card"
          onClick={() => navigate(`/scooters/${otherSlug}`)}
          data-reveal="scale"
        >
          <span className="pdp-other-media">
            <img {...responsiveImage(otherModel.image, "(max-width: 900px) 100vw, 56vw")} alt="" loading="lazy" decoding="async" />
          </span>
          <span className="pdp-other-copy">
            <span className="pdp-kicker">Explore the collection</span>
            <span className="pdp-other-title">There's another way to move.</span>
            <span className="pdp-other-link">
              Discover the {otherModel.name} <span aria-hidden="true">↗</span>
            </span>
          </span>
        </button>
      </section>

      {/* 6 — FAQ */}
      <section className="pdp-section pdp-faq" id="faq">
        <div className="pdp-section-head" data-reveal>
          <p className="pdp-kicker">FAQ</p>
          <h2>
            Good questions. <span>Straight answers.</span>
          </h2>
        </div>

        <div className="pdp-faq-list" data-reveal style={{ "--reveal-delay": "100ms" }}>
          {faqs.map((item, index) => (
            <FaqItem
              key={item.question}
              item={item}
              open={openFaq === index}
              onToggle={() => setOpenFaq((current) => (current === index ? -1 : index))}
            />
          ))}
        </div>
      </section>

      {/* 7 — FINAL ENQUIRY */}
      <section className="pdp-enquire" id="enquire">
        <div className="pdp-enquire-inner" data-reveal>
          <p className="pdp-kicker">Start a conversation</p>
          <h2>
            Make the {model.name}
            <br />
            <span>yours.</span>
          </h2>
          <p>
            Ask about availability, confirmed specifications and pricing. The RENET team will
            follow up personally.
          </p>
          <div className="pdp-cta-row pdp-cta-center">
            <a className="pdp-btn pdp-btn-primary" {...enquiry.linkProps}>
              {enquireLabel} <span aria-hidden="true">↗</span>
            </a>
            {enquiry.channel === "whatsapp" && (
              <a className="pdp-btn pdp-btn-ghost" href={emailUrl(`${model.name} enquiry`)}>
                Email {ENQUIRY_EMAIL}
              </a>
            )}
            <a className="pdp-btn pdp-btn-ghost" href="#test-ride">
              Book a test ride ↓
            </a>
          </div>
        </div>

        <div className="pdp-lead" id="test-ride" data-reveal style={{ "--reveal-delay": "120ms" }}>
          <LeadForm defaultModel={model.name} source={`product-${modelId}`} />
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </main>
  );
}
