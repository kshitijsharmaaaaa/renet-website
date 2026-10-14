import { useId, useState } from "react";
import { Link } from "react-router-dom";
import products, { pendingSpecs, productOrder } from "../data/products";
import { DEFAULTS, LIMITS, estimateCosts, validateInputs } from "../lib/runningCost";
import SmartLink from "./SmartLink";
import { responsiveImage } from "../lib/images";
import "./CompareSection.css";

const rupees = (value, digits = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

// Only published facts (src/data/products.js). Everything else shows as pending.
const CONFIRMED_ROWS = [
  ["Design character", (p) => (p.color === "white" ? "Clean & minimal" : "Bold & sporty")],
  ["Light signature", (p) => p.light],
  ["Colour", (p) => p.shortName],
  ["Type", () => "Electric scooter"],
  ["Market", () => "India"],
];

const FIELDS = [
  { key: "dailyKm", label: "Daily distance", unit: "km", step: 1, slider: true },
  { key: "daysPerMonth", label: "Riding days per month", unit: "days", step: 1 },
  {
    key: "whPerKm",
    label: "Energy use (assumption)",
    unit: "Wh/km",
    step: 1,
    hint: "General assumption for small electric scooters — not an official D-8 figure. Replace it once RENET publishes the D-8's consumption.",
  },
  { key: "tariff", label: "Electricity tariff", unit: "₹/kWh", step: 0.5, hint: "Example — check the rate on your electricity bill." },
  { key: "chargingLossPct", label: "Charging losses", unit: "%", step: 1, hint: "Energy lost while charging (assumption)." },
];

const PETROL_FIELDS = [
  { key: "petrolKmPerL", label: "Your petrol vehicle's mileage", unit: "km/l", step: 1, hint: "Example — use your own vehicle's real mileage." },
  { key: "petrolPrice", label: "Petrol price", unit: "₹/litre", step: 0.5, hint: "Example — enter today's price in your city." },
];

function NumberField({ id, field, value, error, onChange }) {
  const [min, max] = LIMITS[field.key];
  return (
    <div className="cmp-field">
      <label htmlFor={`${id}-${field.key}`}>
        {field.label} <span>({field.unit})</span>
      </label>
      <div className="cmp-input-row">
        {field.slider && (
          <input
            type="range"
            min={min}
            max={150}
            step={field.step}
            value={Math.min(Number(value) || min, 150)}
            onChange={(event) => onChange(field.key, event.target.value)}
            aria-label={`${field.label} slider`}
          />
        )}
        <input
          id={`${id}-${field.key}`}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={field.step}
          value={value}
          onChange={(event) => onChange(field.key, event.target.value)}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={[field.hint && `${id}-${field.key}-hint`, error && `${id}-${field.key}-error`].filter(Boolean).join(" ") || undefined}
        />
      </div>
      {field.hint && (
        <p className="cmp-hint" id={`${id}-${field.key}-hint`}>
          {field.hint}
        </p>
      )}
      {error && (
        <p className="cmp-error" id={`${id}-${field.key}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function CompareSection() {
  const id = useId();
  const [inputs, setInputs] = useState(() => Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, String(v)])));
  const [comparePetrol, setComparePetrol] = useState(true);

  const update = (key, value) => setInputs((current) => ({ ...current, [key]: value }));
  const relevant = comparePetrol ? inputs : { ...inputs, petrolKmPerL: DEFAULTS.petrolKmPerL, petrolPrice: DEFAULTS.petrolPrice };
  const errors = validateInputs(relevant);
  const valid = Object.keys(errors).length === 0;
  const result = valid ? estimateCosts(relevant) : null;

  return (
    <section className="cmp-section" id="compare">
      <div className="section-label" data-reveal>
        <span>04 / COMPARE &amp; RUNNING COSTS</span>
        <span>KNOW BEFORE YOU RIDE</span>
      </div>

      <div className="cmp-head" data-reveal>
        <h2>
          Side by side.
          <br />
          <span>Honestly.</span>
        </h2>
        <p>
          What RENET has confirmed about each D-8 design — and what is still awaiting official
          figures.
        </p>
      </div>

      {/* ---------- Comparison ---------- */}
      <div className="cmp-table-wrap" data-reveal>
        <table className="cmp-table">
          <caption className="cmp-sr-only">D-8 White and D-8 Black compared</caption>
          <thead>
            <tr>
              <th scope="col" className="cmp-corner">
                <span>Specification</span>
              </th>
              {productOrder.map((slug) => (
                <th scope="col" key={slug}>
                  <div className="cmp-model">
                    <span className="cmp-model-media">
                      <img {...responsiveImage(products[slug].image, "(max-width: 600px) 45vw, 30vw")} alt="" loading="lazy" decoding="async" />
                    </span>
                    <strong>{products[slug].name}</strong>
                    <span className="cmp-model-links">
                      <Link to={`/scooters/${slug}`}>Explore ↗</Link>
                      <SmartLink to={`/?model=${slug}&form=test-ride#contact`}>Book a test ride</SmartLink>
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONFIRMED_ROWS.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {productOrder.map((slug) => (
                  <td key={slug}>{value(products[slug])}</td>
                ))}
              </tr>
            ))}
            <tr className="cmp-group-row">
              <th scope="rowgroup" colSpan={3}>
                Awaiting official confirmation
              </th>
            </tr>
            {pendingSpecs.map((spec) => (
              <tr key={spec.label} className="is-pending">
                <th scope="row">{spec.label}</th>
                {productOrder.map((slug) => (
                  <td key={slug}>Awaiting confirmation</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- Running-cost calculator ---------- */}
      <div className="cmp-calc" id="running-costs" data-reveal>
        <div className="cmp-calc-head">
          <p className="cmp-kicker">Running-cost estimator</p>
          <h3>What could your daily ride cost?</h3>
          <p>
            An estimate of energy costs only, from your inputs. It is not a RENET figure and not a
            savings promise.
          </p>
        </div>

        <div className="cmp-calc-body">
          <form className="cmp-inputs" onSubmit={(event) => event.preventDefault()} noValidate>
            {FIELDS.map((field) => (
              <NumberField key={field.key} id={id} field={field} value={inputs[field.key]} error={errors[field.key]} onChange={update} />
            ))}

            <label className="cmp-toggle">
              <input type="checkbox" checked={comparePetrol} onChange={(event) => setComparePetrol(event.target.checked)} />
              Compare with my petrol two-wheeler
            </label>

            {comparePetrol &&
              PETROL_FIELDS.map((field) => (
                <NumberField key={field.key} id={id} field={field} value={inputs[field.key]} error={errors[field.key]} onChange={update} />
              ))}

            <button type="button" className="cmp-reset" onClick={() => setInputs(Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, String(v)])))}>
              Reset to example values
            </button>
          </form>

          <div className="cmp-results" aria-live="polite">
            {!result ? (
              <p className="cmp-results-empty">Fix the highlighted values to see an estimate.</p>
            ) : (
              <>
                <div className="cmp-result is-electric">
                  <span>Estimated electricity cost</span>
                  <strong>
                    {rupees(result.electric.monthly)}
                    <small> / month</small>
                  </strong>
                  <em>
                    {rupees(result.electric.yearly)} a year · {rupees(result.electric.perKm, 2)} per km ·{" "}
                    {result.kWhPerMonth.toFixed(1)} kWh a month
                  </em>
                </div>

                {comparePetrol && (
                  <>
                    <div className="cmp-result">
                      <span>Estimated petrol cost</span>
                      <strong>
                        {rupees(result.petrol.monthly)}
                        <small> / month</small>
                      </strong>
                      <em>
                        {rupees(result.petrol.yearly)} a year · {rupees(result.petrol.perKm, 2)} per km
                      </em>
                    </div>
                    <div className="cmp-result is-difference">
                      <span>Estimated difference in energy cost</span>
                      <strong>
                        {rupees(Math.abs(result.difference.monthly))}
                        <small> / month {result.difference.monthly >= 0 ? "lower with electric" : "higher with electric"}</small>
                      </strong>
                      <em>{rupees(Math.abs(result.difference.yearly))} a year, based on your inputs</em>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="cmp-assumptions">
              <strong>How this is calculated</strong>
              <p>
                Electricity: daily km × riding days × energy use ÷ (1 − charging losses) × tariff.
                Petrol: daily km × riding days ÷ mileage × petrol price.
              </p>
              <p>
                Estimates only. Energy use, tariff and petrol values are assumptions you can change —
                RENET has not yet published the D-8's energy consumption, battery capacity or range.
                Excludes purchase price, maintenance, insurance, registration and battery wear.
                Actual costs depend on riding style, load, terrain and the D-8's official
                specifications.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
