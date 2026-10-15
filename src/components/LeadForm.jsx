import { useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "../lib/api";
import { ENQUIRY_EMAIL, emailUrl, whatsAppUrl } from "../lib/enquiry";
import { D8_COLOURS } from "../data/products";
import "./LeadForm.css";

const MODEL_OPTIONS = ["D-8 White", "D-8 Black", "Not sure yet"];
const NO_COLOUR = "No preference";
const COLOUR_OPTIONS = [NO_COLOUR, ...D8_COLOURS.map((colour) => colour.name)];
const SLUG_TO_MODEL = { "d8-white": "D-8 White", "d8-black": "D-8 Black" };

const CONTACT_METHODS = [
  ["call", "Phone call"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
];

const EMPTY = { name: "", phone: "", city: "", email: "", message: "", consent: false };

// Mirrors the server rules for instant feedback; the server re-validates everything.
function validate(values) {
  const errors = {};
  if (!/^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u.test(values.name.trim())) errors.name = "Enter your name (2–80 letters).";
  const digits = values.phone.replace(/[\s\-()]/g, "").replace(/^\+?91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(digits)) errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (values.city.trim().length < 2) errors.city = "Enter your city.";
  if (values.contactMethod === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (values.message.length > 500) errors.message = "Keep your message under 500 characters.";
  if (!values.consent) errors.consent = "Please confirm RENET may contact you.";
  return errors;
}

/*
  Test ride / call-back request. Submits to the RENET backend (/api/leads) and
  only shows success once the server confirms the request was stored.
  With `syncWithUrl`, "?model=d8-black&form=test-ride" preselects the model —
  used by the scooter advisor and other "Book a test ride" links.
*/
export default function LeadForm({ defaultModel = "Not sure yet", defaultColour = NO_COLOUR, source = "website", syncWithUrl = false }) {
  const id = useId();
  const [searchParams] = useSearchParams();
  const [type, setType] = useState("test-ride");
  const [model, setModel] = useState(defaultModel);
  const [colour, setColour] = useState(defaultColour);
  const [contactMethod, setContactMethod] = useState("call");
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [serverMessage, setServerMessage] = useState("");
  const [reference, setReference] = useState("");

  const urlModel = syncWithUrl ? SLUG_TO_MODEL[searchParams.get("model")] : null;
  const urlType = syncWithUrl ? searchParams.get("form") : null;

  // Follow links like "?model=d8-black" (render-time sync, no effect needed).
  const [appliedUrl, setAppliedUrl] = useState(null);
  const urlKey = `${urlModel}|${urlType}`;
  if (syncWithUrl && urlKey !== appliedUrl) {
    setAppliedUrl(urlKey);
    if (urlModel) setModel(urlModel);
    if (urlType === "test-ride" || urlType === "enquiry") setType(urlType);
  }

  // Product pages: follow the page's model when the visitor switches design.
  const [appliedDefault, setAppliedDefault] = useState(defaultModel);
  if (defaultModel !== appliedDefault) {
    setAppliedDefault(defaultModel);
    setModel(defaultModel);
  }
  // …and the colour selected on the product page.
  const [appliedColour, setAppliedColour] = useState(defaultColour);
  if (defaultColour !== appliedColour) {
    setAppliedColour(defaultColour);
    setColour(defaultColour);
  }

  const update = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const all = { ...values, contactMethod };
    const found = validate(all);
    setErrors(found);
    if (Object.keys(found).length) {
      // Errors render on the next paint, so focus the first invalid field by id.
      const first = ["name", "phone", "city", "email", "message", "consent"].find((field) => found[field]);
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }

    setStatus("sending");
    setServerMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          model,
          colour: colour === NO_COLOUR ? undefined : colour,
          contactMethod,
          name: values.name,
          phone: values.phone,
          city: values.city,
          email: values.email || undefined,
          message: values.message || undefined,
          consent: values.consent,
          source,
          company_url: form.elements.company_url?.value || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 201 && data.ok) {
        setReference(String(data.id || "").slice(0, 8).toUpperCase());
        setStatus("success");
        setValues(EMPTY);
        return;
      }
      if (data.fields) setErrors(data.fields);
      setServerMessage(data.error || "We couldn't send your request. Please try again.");
      setStatus("error");
    } catch {
      setServerMessage("We couldn't reach the RENET booking system. Please check your connection and try again.");
      setStatus("error");
    }
  };

  const fieldProps = (field) => ({
    id: `${id}-${field}`,
    "aria-invalid": errors[field] ? "true" : "false",
    "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
  });

  const fieldError = (field) =>
    errors[field] ? (
      <span className="lf-error" id={`${id}-${field}-error`}>
        {errors[field]}
      </span>
    ) : null;

  const whatsApp = whatsAppUrl(
    `Hi RENET, I'd like to book a test ride${model !== "Not sure yet" ? ` of the ${model}` : ""}${colour !== NO_COLOUR ? ` (colour: ${colour})` : ""}.`,
  );

  if (status === "success") {
    return (
      <div className="lead-form lf-success" role="status">
        <span className="lf-success-icon" aria-hidden="true">✓</span>
        <h3>{type === "test-ride" ? "Test ride request received." : "Request received."}</h3>
        <p>
          Thank you. The RENET team will contact you by{" "}
          {CONTACT_METHODS.find(([value]) => value === contactMethod)[1].toLowerCase()} to confirm
          {type === "test-ride" ? " test ride availability and timing" : " the details"}.
        </p>
        {reference && <p className="lf-reference">Reference: {reference}</p>}
        <button type="button" className="lf-secondary" onClick={() => setStatus("idle")}>
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={submit} noValidate>
      <div className="lf-type" role="radiogroup" aria-label="Request type">
        {[
          ["test-ride", "Book a test ride"],
          ["enquiry", "Request a call-back"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            role="radio"
            aria-checked={type === value}
            className={type === value ? "is-active" : ""}
            onClick={() => setType(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="lf-grid">
        <label className="lf-field">
          <span>Full name *</span>
          <input {...fieldProps("name")} value={values.name} onChange={update("name")} autoComplete="name" maxLength={80} placeholder="Your name" />
          {fieldError("name")}
        </label>

        <label className="lf-field">
          <span>Mobile number *</span>
          <input
            {...fieldProps("phone")}
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={update("phone")}
            autoComplete="tel"
            maxLength={16}
            placeholder="98765 43210"
          />
          {fieldError("phone")}
        </label>

        <label className="lf-field">
          <span>City *</span>
          <input {...fieldProps("city")} value={values.city} onChange={update("city")} autoComplete="address-level2" maxLength={60} placeholder="e.g. Pune" />
          {fieldError("city")}
        </label>

        <label className="lf-field">
          <span>Preferred model *</span>
          <select id={`${id}-model`} value={model} onChange={(event) => setModel(event.target.value)}>
            {MODEL_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="lf-field">
          <span>Preferred colour</span>
          <select id={`${id}-colour`} value={colour} onChange={(event) => setColour(event.target.value)}>
            {COLOUR_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="lf-methods">
        <legend>How should we contact you? *</legend>
        <div>
          {CONTACT_METHODS.map(([value, label]) => (
            <label key={value} className={contactMethod === value ? "is-active" : ""}>
              <input type="radio" name={`${id}-method`} value={value} checked={contactMethod === value} onChange={() => setContactMethod(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {contactMethod === "email" && (
        <label className="lf-field">
          <span>Email address *</span>
          <input {...fieldProps("email")} type="email" value={values.email} onChange={update("email")} autoComplete="email" maxLength={254} placeholder="you@example.com" />
          {fieldError("email")}
        </label>
      )}

      <label className="lf-field">
        <span>Anything we should know? (optional)</span>
        <textarea {...fieldProps("message")} value={values.message} onChange={update("message")} rows={3} maxLength={500} placeholder="Preferred day or time, questions…" />
        {fieldError("message")}
      </label>

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it */}
      <div className="lf-honeypot" aria-hidden="true">
        <label>
          Company website
          <input name="company_url" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="lf-consent">
        <input {...fieldProps("consent")} type="checkbox" checked={values.consent} onChange={update("consent")} />
        <span>I agree that RENET may contact me about this request. My details are used only for this purpose.</span>
      </label>
      {fieldError("consent")}

      {status === "error" && (
        <div className="lf-alert" role="alert">
          <p>{serverMessage}</p>
          <p>
            You can also reach RENET directly
            {whatsApp && (
              <>
                {" "}on{" "}
                <a href={whatsApp} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>{" "}
                or
              </>
            )}{" "}
            at <a href={emailUrl("Test ride request")}>{ENQUIRY_EMAIL}</a>.
          </p>
        </div>
      )}

      <button type="submit" className="lf-submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : type === "test-ride" ? "Request test ride" : "Request call-back"}
        <span aria-hidden="true">{status === "sending" ? "" : "↗"}</span>
      </button>
      <p className="lf-note">
        {type === "test-ride"
          ? "Test ride availability and location are confirmed by the RENET team."
          : "The RENET team will get back to you using your preferred method."}
      </p>
    </form>
  );
}
