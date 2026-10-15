import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import products, { D8_COLOURS, faqs, pendingSpecs, productOrder } from "./data/products";
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

// Five-colour selector: a radio group (arrow keys move and select, like native radios).
function ColourSelector({ colours, selectedId, onSelect }) {
  const refs = useRef({});
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const index = colours.findIndex((colour) => colour.id === selectedId);
    let next = null;
    if (step) next = colours[(index + step + colours.length) % colours.length];
    if (event.key === "Home") next = colours[0];
    if (event.key === "End") next = colours.at(-1);
    if (!next) return;
    event.preventDefault();
    onSelect(next);
    refs.current[next.id]?.focus();
  };

  return (
    <div className="pdp-colours" role="radiogroup" aria-label="Choose a colour" onKeyDown={onKeyDown}>
      {colours.map((colour) => {
        const selected = colour.id === selectedId;
        return (
          <button
            type="button"
            key={colour.id}
            ref={(element) => (refs.current[colour.id] = element)}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={selected ? "pdp-colour is-active" : "pdp-colour"}
            onClick={() => onSelect(colour)}
          >
            <span className="pdp-colour-dot" style={{ "--swatch": colour.swatch }} aria-hidden="true" />
            <span className="pdp-colour-name">{colour.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ProductPage() {
  const { modelId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
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

  /*
    Selected colour: from ?colour= (so it survives reloads and other controls),
    otherwise the colour of this model page. A colour that has its own model
    page is only valid on that page.
  */
  const pageColour = D8_COLOURS.find((colour) => colour.modelSlug === modelId);
  const requested = D8_COLOURS.find((colour) => colour.id === searchParams.get("colour"));
  const validHere = (option) => (option.modelSlug ? option.modelSlug === modelId : true);
  const colour = requested && validHere(requested) ? requested : pageColour;
  // Preview image of the selected colour on THIS design (single or double light).
  const previewImage = colour.previews?.[modelId] ?? null;
  // How the selected colour is shown: model photos | digital preview | supplied photo | pending
  const mode =
    colour.modelSlug === modelId ? "model" : previewImage ? "preview" : colour.image ? "photo" : "pending";
  const showsModelPhotos = mode === "model";
  const isPreview = mode === "preview";
  const colourIndex = D8_COLOURS.indexOf(colour) + 1;
  const previewColours = D8_COLOURS.filter((option) => option.previews?.[modelId]);
  // Gallery view with its photo swapped for the selected colour preview.
  const viewFor = (view) => (isPreview && view.src === model.image ? { ...view, src: previewImage } : view);

  const selectColour = (next) => {
    if (next.modelSlug) {
      // White / Black have their own pages with authentic galleries.
      navigate(`/scooters/${next.modelSlug}`, { replace: next.modelSlug === modelId, state: { keepScroll: true } });
    } else {
      // Stay on the current design (single or double light) and show its preview.
      navigate(`/scooters/${modelId}?colour=${next.id}`, { replace: true, state: { keepScroll: true } });
    }
  };

  // Every enquiry on this page carries the model and the selected colour.
  const enquiryName = `RENET D-8 (colour: ${colour.name})`;
  const enquiry = enquiryLink(enquiryName);
  const enquireLabel = enquiry.channel === "whatsapp" ? "Enquire on WhatsApp" : "Enquire now";
  const otherSlug = productOrder.find((slug) => slug !== modelId);
  const otherModel = products[otherSlug];
  // Previews exist only for views of the main studio photo (not e.g. the night close-up).
  const galleryViews = isPreview ? model.gallery.filter((view) => view.src === model.image) : model.gallery;
  const activeViewId = viewByModel[modelId] ?? galleryViews[0].id;
  const activeView = galleryViews.find((view) => view.id === activeViewId) ?? galleryViews[0];

  // Every view of every model stays mounted so finish and view changes crossfade.
  const stageLayers = productOrder.flatMap((slug) =>
    products[slug].gallery.map((view) => ({ slug, view, key: `${slug}-${view.id}` })),
  );

  return (
    <main className={`pdp pdp-${model.color}`}>
      {/* SHARED HEADER — product sections + model-specific enquiry */}
      <SiteHeader links={PRODUCT_NAV} model={enquiryName} />

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
          {isPreview && (
            <img
              key={colour.id}
              {...responsiveImage(previewImage, "(max-width: 760px) 100vw, 74vw")}
              alt=""
              className="pdp-hero-image is-active is-preview"
            />
          )}
        </div>

        <div className="pdp-hero-copy">
          <p className="pdp-eyebrow pdp-enter" style={{ "--enter-delay": "0.15s" }}>
            <span className="pdp-dot" /> RENET D-8 · DESIGN SERIES {model.id}
          </p>

          <h1 key={modelId} className="pdp-hero-title">
            <span className="pdp-line">Meet the</span>{" "}
            <span className="pdp-line pdp-line-accent">{isPreview ? `D-8 ${colour.name}` : model.name}.</span>
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
          [colour.name, "Selected colour"],
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
            Look closer at the <span>{showsModelPhotos ? model.name : `D-8 in ${colour.name}`}.</span>
          </h2>
        </div>

        <div className="pdp-gallery-layout">
          <div className="pdp-gallery-main" data-reveal="scale">
            <div className="pdp-stage">
              {stageLayers.map(({ slug, view, key }) => {
                const active = showsModelPhotos && slug === modelId && view.id === activeView.id;
                return (
                  <ShotImage
                    key={key}
                    view={view}
                    alt={active ? `${products[slug].name} — ${view.label}` : ""}
                    className={active ? "is-active" : ""}
                    loading={slug === modelId ? "eager" : "lazy"}
                  />
                );
              })}

              {/* Digital colour previews: every gallery view, recoloured (mounted so switching is instant) */}
              {previewColours.flatMap((option) =>
                model.gallery
                  .filter((view) => view.src === model.image)
                  .map((view) => {
                    const active = isPreview && option.id === colour.id && view.id === activeView.id;
                    return (
                      <ShotImage
                        key={`preview-${option.id}-${view.id}`}
                        view={{ ...view, src: option.previews[modelId] }}
                        alt={active ? `RENET D-8 in ${option.name} (digital colour preview) — ${view.label}` : ""}
                        className={active ? "is-active" : ""}
                        loading="lazy"
                      />
                    );
                  }),
              )}

              {/* Authentic photos supplied for colours without their own page */}
              {D8_COLOURS.filter((option) => option.image && !option.modelSlug).map((option) => (
                <ShotImage
                  key={`colour-${option.id}`}
                  view={{ src: option.image, focus: "50% 50%", zoom: 1 }}
                  alt={option.id === colour.id ? `RENET D-8 in ${option.name}` : ""}
                  className={option.id === colour.id ? "is-active" : ""}
                  loading="lazy"
                />
              ))}

              {/* No authentic photo yet: say so — never show another colour's scooter */}
              <div
                className={mode === "pending" ? "pdp-colour-pending is-active" : "pdp-colour-pending"}
                style={{ "--swatch": colour.swatch }}
                role={mode === "pending" ? "img" : undefined}
                aria-label={mode === "pending" ? `${colour.name}: official photo coming soon` : undefined}
                aria-hidden={mode !== "pending"}
              >
                <span className="pdp-colour-pending-dot" />
                <strong>{colour.name}</strong>
                <span>Official photo of the D-8 in {colour.name} coming soon</span>
              </div>

              {/* The "coming soon" panel already names the colour */}
              {mode !== "pending" && (
                <span className="pdp-stage-label">
                  {showsModelPhotos
                    ? `${model.name} · ${activeView.label}`
                    : isPreview
                      ? `D-8 ${colour.name} · ${activeView.label}`
                      : `RENET D-8 · ${colour.name}`}
                </span>
              )}
              {isPreview && <span className="pdp-preview-badge">Digital colour preview</span>}
            </div>

            <div className="pdp-thumbs" role="group" aria-label="Gallery views">
              {galleryViews.map((view) => (
                <button
                  type="button"
                  key={view.id}
                  className={(showsModelPhotos || isPreview) && view.id === activeView.id ? "pdp-thumb is-active" : "pdp-thumb"}
                  aria-pressed={(showsModelPhotos || isPreview) && view.id === activeView.id}
                  aria-label={`${isPreview ? `D-8 ${colour.name} (preview)` : model.name} — ${view.label}`}
                  onClick={() => {
                    setViewByModel((current) => ({ ...current, [modelId]: view.id }));
                    if (!showsModelPhotos && !isPreview) selectColour(pageColour);
                  }}
                >
                  <span className="pdp-thumb-frame">
                    <ShotImage view={viewFor(view)} alt="" loading="lazy" vw={16} />
                  </span>
                  <span className="pdp-thumb-label">{view.label}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="pdp-finish" data-reveal style={{ "--reveal-delay": "120ms" }}>
            <p className="pdp-finish-index">
              Colour · 0{colourIndex} / 0{D8_COLOURS.length}
            </p>
            <h3 aria-live="polite">{showsModelPhotos ? model.name : `D-8 ${colour.name}`}</h3>
            <p className="pdp-finish-category">
              {showsModelPhotos
                ? model.category
                : isPreview
                  ? `Digital colour preview · ${model.light} design`
                  : "Electric scooter · details to be confirmed"}
            </p>

            <ColourSelector colours={D8_COLOURS} selectedId={colour.id} onSelect={selectColour} />

            <p className="pdp-finish-copy">
              {showsModelPhotos
                ? model.description
                : isPreview
                  ? `A digital preview of the ${model.light.toLowerCase()} D-8 in ${colour.name}, recoloured from the official ${model.name} photo. The actual paint shade, finish and painted areas may differ — the RENET team can confirm availability and show you the real colour.`
                  : `The RENET D-8 in ${colour.name}. Official photos of this colour are coming soon — the RENET team can confirm availability and details.`}
            </p>
            <p className="pdp-finish-note">Availability of each colour is confirmed by RENET.</p>

            <a className="pdp-btn pdp-btn-dark" {...enquiry.linkProps}>
              Enquire about the D-8 in {colour.name} <span aria-hidden="true">↗</span>
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
              <a className="pdp-btn pdp-btn-ghost" href={emailUrl(`${enquiryName} enquiry`)}>
                Email {ENQUIRY_EMAIL}
              </a>
            )}
            <a className="pdp-btn pdp-btn-ghost" href="#test-ride">
              Book a test ride ↓
            </a>
          </div>
        </div>

        <div className="pdp-lead" id="test-ride" data-reveal style={{ "--reveal-delay": "120ms" }}>
          <LeadForm defaultModel={model.name} defaultColour={colour.name} source={`product-${modelId}`} />
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </main>
  );
}
