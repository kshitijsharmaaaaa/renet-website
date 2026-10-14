import { Link } from "react-router-dom";
import { ENQUIRY_EMAIL, WHATSAPP_NUMBER, emailUrl, enquiryLink, whatsAppUrl } from "../lib/enquiry";
import SmartLink from "./SmartLink";
import "./SiteFooter.css";

const YEAR = new Date().getFullYear();

const COLUMNS = [
  {
    title: "Scooters",
    links: [
      ["D-8 White", "/scooters/d8-white"],
      ["D-8 Black", "/scooters/d8-black"],
      ["Compare models", "/#compare"],
      ["Running costs", "/#running-costs"],
      ["Find your ride", "/#find-scooter"],
    ],
  },
  {
    title: "RENET",
    links: [
      ["Our story", "/#story"],
      ["Design highlights", "/#highlights"],
      ["What moves us", "/#values"],
      ["Reviews", "/#reviews"],
    ],
  },
];

// Shared footer for the homepage and product pages.
export default function SiteFooter() {
  const enquiry = enquiryLink();
  const whatsApp = whatsAppUrl("Hi RENET, I'd like to know more about the D-8 electric scooter.");

  return (
    <footer className="rn-footer">
      <div className="rn-footer-top">
        <div className="rn-footer-brand">
          <Link to="/" className="rn-footer-wordmark" aria-label="RENET home">
            RENET<span>.</span>
          </Link>
          <p>An electric mobility brand from India. A little less ordinary.</p>
          <a className="rn-footer-cta" {...enquiry.linkProps}>
            Enquire now <span aria-hidden="true">↗</span>
          </a>
        </div>

        <nav className="rn-footer-columns" aria-label="Footer">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2>{column.title}</h2>
              {column.links.map(([label, to]) => (
                <SmartLink key={to} to={to}>
                  {label}
                </SmartLink>
              ))}
            </div>
          ))}
          <div>
            <h2>Contact</h2>
            <a href={emailUrl("RENET enquiry")}>{ENQUIRY_EMAIL}</a>
            {whatsApp && (
              <a href={whatsApp} target="_blank" rel="noopener noreferrer">
                WhatsApp +{WHATSAPP_NUMBER.slice(0, 2)} {WHATSAPP_NUMBER.slice(2)}
              </a>
            )}
            <SmartLink to="/?form=test-ride#contact">Book a test ride</SmartLink>
          </div>
        </nav>
      </div>

      <div className="rn-footer-bottom">
        <span>© {YEAR} RENET</span>
        <span>Specifications, pricing and availability are confirmed directly by RENET.</span>
        <a
          href="#top"
          onClick={(event) => {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}
