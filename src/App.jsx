import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./App.css";
import "./styles/premium-home.css";
import FloatingWidgets from "./components/FloatingWidgets";
import ScooterCarousel from "./components/ScooterCarousel";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import HomeHero from "./components/HomeHero";
import HomeHighlights from "./components/HomeHighlights";
import LeadForm from "./components/LeadForm";
import { responsiveImage } from "./lib/images";
import CompareSection from "./components/CompareSection";
import ReviewsCarousel from "./components/ReviewsCarousel";
import reviews from "./data/reviews";
import useScrollReveal from "./hooks/useScrollReveal";

const models = [

  {

    id: "01",

    name: "D-8 White",

    category: "SINGLE LIGHT · ELECTRIC SCOOTER",

    tagline: "A clean, minimal look for everyday journeys.",

    image: "/renet-d8-white.png",

    color: "white",

  },

  {

    id: "02",

    name: "D-8 Black",

    category: "DOUBLE LIGHT · ELECTRIC SCOOTER",

    tagline: "A bold, sporty look. Move your own way.",

    image: "/renet-d8-black.png",

    color: "black",

  },

];

const quizQuestions = [

  {

    title: "How far is a typical day's ride for you?",

    subtitle: "Count the round trip on an ordinary weekday.",

    options: [

      { label: "Up to 20 km", value: "short" },

      { label: "Between 20 and 50 km", value: "medium" },

      { label: "More than 50 km", value: "long" },

    ],

  },

  {

    title: "What is your main purpose?",

    subtitle: "Where will your RENET fit into your life?",

    options: [

      { label: "College or office", value: "commute" },

      { label: "Daily errands", value: "errands" },

      { label: "Frequent longer journeys", value: "journeys" },

    ],

  },

  {

    title: "What matters most to you?",

    subtitle: "Choose what you care about most.",

    options: [

      { label: "A clean, minimal look", value: "minimal" },

      { label: "A bold, sporty look", value: "sporty" },

      { label: "Everyday practicality", value: "practical" },

    ],

  },

  {

    title: "Which design do you prefer?",

    subtitle: "Choose your favourite look.",

    options: [

      { label: "White — Single Light", value: "white" },

      { label: "Black — Double Light", value: "black" },

      { label: "Surprise me", value: "any" },

    ],

  },

];

const HOME_NAV = [
  { label: "Scooters", to: "#models" },
  { label: "Compare", to: "#compare" },
  { label: "Highlights", to: "#highlights" },
  { label: "Our story", to: "#story" },
  { label: "Reviews", to: "#reviews" },
  { label: "Contact", to: "#contact" },
];

function HomePage() {

  // Index of the scooter currently in front of the lineup carousel.
  const [activeModel, setActiveModel] = useState(0);

  // Links like "/#contact" or "/?model=d8-black&form=test-ride#contact" (product
  // pages, footer, scooter advisor): scroll to the section on every arrival.
  const { hash, search, key: locationKey } = useLocation();
  const [contactTab, setContactTab] = useState("test-ride");
  const [lastLocationKey, setLastLocationKey] = useState(locationKey);
  if (locationKey !== lastLocationKey) {
    setLastLocationKey(locationKey);
    if (new URLSearchParams(search).has("form")) setContactTab("test-ride");
  }
  useEffect(() => {
    if (!hash) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, locationKey]);


  const [quizStep, setQuizStep] = useState(0);

  const [quizAnswers, setQuizAnswers] = useState([]);

  const [quizComplete, setQuizComplete] = useState(false);

  
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    model: "D-8 White",
    message: "",
  });
  const [contactStatus, setContactStatus] = useState("idle");

  const updateContactForm = (event) => {
    const { name, value } = event.target;
    setContactForm((previous) => ({ ...previous, [name]: value }));
  };

  const submitContactForm = async (event) => {
    event.preventDefault();
    setContactStatus("sending");

    try {
      const response = await fetch("https://formsubmit.co/ajax/info@renet.in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...contactForm,
          _subject: `RENET website enquiry — ${contactForm.model}`,
          _replyto: contactForm.email,
          _autoresponse: `Hi ${contactForm.name},\n\nThank you for contacting RENET about ${contactForm.model}. We have received your enquiry and our team will review your message.\n\nIf you need to add anything, you can reply to this email.\n\nRegards,\nRENET Team`,
          _template: "table",
          _captcha: "false",
        }),
      });

      const result = await response.json();
      if (!response.ok || result.success !== "true") {
        throw new Error("Email service did not accept the submission.");
      }

      setContactStatus("success");
      setContactForm({
        name: "",
        email: "",
        phone: "",
        model: "D-8 White",
        message: "",
      });
    } catch {
      setContactStatus("error");
    }
  };
const currentModel = models[activeModel];

  const chooseAnswer = (value) => {

    setQuizAnswers((previous) => {

      const updated = [...previous];

      updated[quizStep] = value;

      return updated;

    });

  };

  const recommendation = (() => {

    if (quizAnswers[3] === "white") return models[0];

    if (quizAnswers[3] === "black") return models[1];

    if (quizAnswers[2] === "sporty") return models[1];

    if (quizAnswers[2] === "minimal") return models[0];

    return activeModel === 1 ? models[1] : models[0];

  })();

  const resetQuiz = () => {

    setQuizStep(0);

    setQuizAnswers([]);

    setQuizComplete(false);

  };

  return (

    <main>

      {/* NAVIGATION */}
      <SiteHeader links={HOME_NAV} />

      {/* HERO */}
      <HomeHero />

      {/* BRAND STORY */}

      <section className="manifesto" id="story">

        <div className="section-label" data-reveal>

          <span>01 / THE RENET PHILOSOPHY</span>

          <span>BUILT AROUND YOU</span>

        </div>

        <div className="hm-story">
          <div className="hm-story-copy" data-reveal>
            <h2>
              The future isn't
              <br />
              somewhere ahead.
              <br />
              <span>It's how we move.</span>
            </h2>
            <p>
              We see everyday mobility differently. More considered. More intentional. More
              connected to the world around us. This is the beginning of a different journey.
            </p>
            <a href="#models" className="rn-btn rn-btn-dark">
              Meet the D-8 <span aria-hidden="true">↓</span>
            </a>
          </div>

          <figure className="hm-story-media" data-reveal="scale" style={{ "--reveal-delay": "120ms" }}>
            <img {...responsiveImage("/renet-d8-black.png", "(max-width: 900px) 100vw, 45vw")} alt="RENET D-8 Black with rider in the studio" loading="lazy" decoding="async" />
            <figcaption>
              <span>RENET D-8</span>
              Designed around the everyday
            </figcaption>
          </figure>
        </div>

      </section>

      {/* SCOOTER LINEUP */}

      <section className="models-section" id="models">

        <div className="section-label" data-reveal>

          <span>02 / THE LINEUP</span>

          <span>FIND YOUR RIDE</span>

        </div>

        <div className="scooter-heading" data-reveal>

          <p>ENGINEERED FOR EVERYDAY.</p>

          <h2>

            Meet your <span>next move.</span>

          </h2>

        </div>

        <ScooterCarousel models={models} onActiveChange={setActiveModel} />

        <p className="disclaimer">

          Product specifications and availability must be confirmed with RENET.

        </p>

      </section>

      {/* DESIGN HIGHLIGHTS */}
      <HomeHighlights />

      {/* COMPARE MODELS + RUNNING-COST CALCULATOR */}
      <CompareSection />

      {/* SCOOTER FINDER QUIZ */}

      <section className="finder-section" id="find-scooter">

        <div className="section-label" data-reveal>

          <span>05 / FIND YOUR RIDE</span>

          <span>MADE AROUND YOU</span>

        </div>

        <div className="finder-heading" data-reveal>

          <p>YOUR DAILY RIDE, DECODED.</p>

          <h2>

            Which D-8 fits

            <br />

            <span>your everyday?</span>

          </h2>

          <p>Four quick choices. One personal suggestion.</p>

        </div>

        {!quizComplete ? (

          <div className="finder-layout" key="finder-quiz" data-reveal>

            <div className="finder-question">

              <div className="finder-meta">

                <span>Find my scooter</span>

                <span>

                  {quizStep + 1} / {quizQuestions.length}

                </span>

              </div>

              <div className="finder-progress">

                <span

                  style={{

                    width: `${((quizStep + 1) / quizQuestions.length) * 100}%`,

                  }}

                />

              </div>

              <h3>{quizQuestions[quizStep].title}</h3>

              <p className="finder-subtitle">

                {quizQuestions[quizStep].subtitle}

              </p>

              <div className="finder-options">

                {quizQuestions[quizStep].options.map((option) => (

                  <button

                    type="button"

                    key={option.value}

                    className={

                      quizAnswers[quizStep] === option.value

                        ? "finder-option chosen"

                        : "finder-option"

                    }

                    onClick={() => chooseAnswer(option.value)}

                    aria-pressed={quizAnswers[quizStep] === option.value}

                  >

                    <span>{option.label}</span>

                    <span className="finder-option-mark">

                      {quizAnswers[quizStep] === option.value ? "✓" : "↗"}

                    </span>

                  </button>

                ))}

              </div>

              <div className="finder-controls">

                <button

                  type="button"

                  className="finder-back"

                  disabled={quizStep === 0}

                  onClick={() => setQuizStep((step) => step - 1)}

                >

                  ← Back

                </button>

                <button

                  type="button"

                  className="finder-next"

                  disabled={!quizAnswers[quizStep]}

                  onClick={() => {

                    if (quizStep < quizQuestions.length - 1) {

                      setQuizStep((step) => step + 1);

                    } else {

                      setQuizComplete(true);

                    }

                  }}

                >

                  {quizStep === quizQuestions.length - 1

                    ? "See my match ↗"

                    : "Next →"}

                </button>

              </div>

            </div>

            <div className="finder-preview">

              <span className="finder-preview-number">

                0{quizStep + 1}

                <span> / 04</span>

              </span>

              <div className="finder-orb" />

              <p>

                A few quick choices to help you discover your RENET style.

              </p>

              <span className="finder-preview-brand">ϟ RENET</span>

            </div>

          </div>

        ) : (

          <div className="finder-result" key="finder-result" data-reveal>

            <div className="finder-result-copy">

              <span className="scooter-category">YOUR PERSONAL MATCH</span>

              <h3>

                Meet your next

                <br />

                <span>RENET ride.</span>

              </h3>

              <p>

                {recommendation.color === "white"

                  ? "Your answers point towards the white Single Light design."

                  : "Your answers point towards the black Double Light design."}

              </p>

              <p className="finder-note">

                This suggestion is based on your preferences, not verified

                range or performance data. Confirm technical specifications

                with RENET before purchase.

              </p>

              <div className="scooter-card-actions">

                <a href="#contact">Enquire about this model ↗</a>

                <button type="button" onClick={resetQuiz}>

                  Retake quiz ↻

                </button>

              </div>

            </div>

            <div className="finder-result-image">

              <img

                {...responsiveImage(recommendation.image, "(max-width: 900px) 100vw, 50vw")}

                alt={recommendation.name}

                loading="lazy"

              />

              <span>{recommendation.category}</span>

            </div>

          </div>

        )}

      </section>

      {/* CUSTOMER REVIEWS — placeholder content, see src/data/reviews.js */}

      <section className="reviews-section" id="reviews">

        <div className="section-label" data-reveal>

          <span>06 / IN THEIR WORDS</span>

          <span>CUSTOMER STORIES</span>

        </div>

        <div className="reviews-heading" data-reveal>

          <div>

            <p>WHAT PEOPLE NOTICE</p>

            <h2>

              Different,

              <br />

              <span>by every account.</span>

            </h2>

          </div>

          <p className="reviews-intro">

            First impressions of RENET and the D-8 design series.

          </p>

        </div>

        {reviews.some((review) => review.placeholder) && (

          <p className="reviews-sample-note" data-reveal>

            Sample reviews shown — verified customer feedback coming soon.

          </p>

        )}

        <div data-reveal style={{ "--reveal-delay": "120ms" }}>

          <ReviewsCarousel reviews={reviews} />

        </div>

      </section>

      {/* BRAND VALUES & TECHNOLOGY */}

      <section className="values-section" id="values">

        <div className="section-label" data-reveal>

          <span>07 / WHAT MOVES US</span>

          <span>THE DETAILS MATTER</span>

        </div>

        <div className="values-heading" data-reveal>

          <h2>

            Different by

            <br />

            <span>design.</span>

          </h2>

          <p>

            Good design doesn't need to shout. You feel it in every detail.

          </p>

        </div>

        <div className="values-grid">

          <article className="value-card" data-reveal>

            <span className="value-index">01</span>

            <span className="value-icon">↗</span>

            <h3>

              Thoughtful

              <br />

              by design.

            </h3>

            <p>Every detail begins with the people who will use it.</p>

          </article>

          <article className="value-card value-card-featured" data-reveal style={{ "--reveal-delay": "120ms" }}>

            <span className="value-index">02</span>

            <span className="value-icon">ϟ</span>

            <h3>

              Electric

              <br />

              by nature.

            </h3>

            <p>A new perspective on everyday electric mobility.</p>

          </article>

          <article className="value-card" data-reveal style={{ "--reveal-delay": "240ms" }}>

            <span className="value-index">03</span>

            <span className="value-icon">↗</span>

            <h3>

              Ready for

              <br />

              what's next.

            </h3>

            <p>Looking ahead while keeping the everyday in mind.</p>

          </article>

        </div>

      </section>

      {/* CONTACT */}
      <section className="contact-section contact-section-updated" id="contact">
        <div className="contact-content contact-content-updated">
          <div className="section-label" data-reveal>
            <span>08 / START A CONVERSATION</span>
            <span>WE'D LOVE TO HEAR FROM YOU</span>
          </div>

          <div className="contact-form-layout">
            <div className="contact-intro-copy" data-reveal>
              <h2>
                Every journey
                <br />
                starts with <span>hello.</span>
              </h2>
              <p>
                Curious about RENET D-8? Send us your details and our team can
                follow up about the model, availability and your questions.
              </p>
              <div className="contact-trust-note">
                <span aria-hidden="true">✓</span>
                <span>Test ride requests go straight to the RENET team. Messages are sent to info@renet.in.</span>
              </div>
            </div>

            <div className="contact-tabs-wrap" data-reveal style={{ "--reveal-delay": "120ms" }}>
              <div className="contact-tabs" role="tablist" aria-label="How would you like to get in touch?">
                {[
                  ["test-ride", "Book a test ride"],
                  ["message", "Send a message"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    role="tab"
                    id={`contact-tab-${value}`}
                    aria-selected={contactTab === value}
                    aria-controls={`contact-panel-${value}`}
                    className={contactTab === value ? "is-active" : ""}
                    onClick={() => setContactTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                role="tabpanel"
                id="contact-panel-test-ride"
                aria-labelledby="contact-tab-test-ride"
                hidden={contactTab !== "test-ride"}
              >
                <LeadForm source="homepage-contact" syncWithUrl />
              </div>

              <div
                role="tabpanel"
                id="contact-panel-message"
                aria-labelledby="contact-tab-message"
                hidden={contactTab !== "message"}
              >
            <form className="renet-contact-form" onSubmit={submitContactForm}>
              {contactStatus === "success" ? (
                <div className="contact-form-feedback success" role="status">
                  <span className="contact-feedback-icon">✓</span>
                  <h3>Enquiry sent.</h3>
                  <p>Thanks for reaching out. Your enquiry has been submitted.</p>
                  <button
                    type="button"
                    className="contact-reset-button"
                    onClick={() => setContactStatus("idle")}
                  >
                    Send another enquiry ↗
                  </button>
                </div>
              ) : (
                <>
                  <div className="contact-field">
                    <label htmlFor="contact-name">YOUR NAME *</label>
                    <input id="contact-name" name="name" value={contactForm.name}
                      onChange={updateContactForm} autoComplete="name"
                      placeholder="Enter your full name" required />
                  </div>

                  <div className="contact-field-row">
                    <div className="contact-field">
                      <label htmlFor="contact-email">EMAIL ADDRESS *</label>
                      <input id="contact-email" type="email" name="email"
                        value={contactForm.email} onChange={updateContactForm}
                        autoComplete="email" placeholder="you@example.com" required />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="contact-phone">PHONE NUMBER</label>
                      <input id="contact-phone" type="tel" name="phone"
                        value={contactForm.phone} onChange={updateContactForm}
                        autoComplete="tel" inputMode="tel" placeholder="+91 00000 00000" />
                    </div>
                  </div>

                  <div className="contact-field">
                    <label htmlFor="contact-model">MODEL OF INTEREST</label>
                    <select id="contact-model" name="model" value={contactForm.model}
                      onChange={updateContactForm}>
                      <option>D-8 White</option>
                      <option>D-8 Black</option>
                      <option>General enquiry</option>
                    </select>
                  </div>

                  <div className="contact-field">
                    <label htmlFor="contact-message">YOUR MESSAGE</label>
                    <textarea id="contact-message" name="message"
                      value={contactForm.message} onChange={updateContactForm}
                      rows="4" placeholder="Tell us what you'd like to know..." />
                  </div>

                  {contactStatus === "error" && (
                    <p className="contact-form-error" role="alert">
                      We couldn't send your enquiry. Please try again or email
                      info@renet.in directly.
                    </p>
                  )}

                  <button type="submit" className="contact-button contact-submit-button"
                    disabled={contactStatus === "sending"}>
                    {contactStatus === "sending" ? "SENDING..." : "SEND ENQUIRY"}
                    <span>{contactStatus === "sending" ? "…" : "↗"}</span>
                  </button>
                  <p className="contact-form-privacy">
                    By submitting, you agree that RENET may contact you about
                    this enquiry.
                  </p>
                </>
              )}
            </form>
              </div>
            </div>
          </div>
        </div>
        <div className="contact-giant" aria-hidden="true">R.</div>
      </section>

      {/* FOOTER */}
      <SiteFooter />

    </main>

  );

}

// Product pages load as a separate chunk; it is prefetched while the browser is
// idle so "Explore model" still opens instantly.
const loadProductPage = () => import("./ProductPage");
const ProductPage = lazy(loadProductPage);

function usePrefetchWhenIdle(load) {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((callback) => setTimeout(callback, 2000));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const handle = idle(() => load());
    return () => cancel(handle);
  }, [load]);
}

export default function App() {
  useScrollReveal();
  usePrefetchWhenIdle(loadProductPage);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/scooters/:modelId"
          element={
            <Suspense fallback={<main className="route-loading" aria-busy="true" />}>
              <ProductPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FloatingWidgets />
    </BrowserRouter>
  );
}
