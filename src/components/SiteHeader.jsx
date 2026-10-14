import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { enquiryLink } from "../lib/enquiry";
import SmartLink from "./SmartLink";
import { responsiveImage } from "../lib/images";
import "./SiteHeader.css";

/*
  Shared RENET header (homepage + product pages).
  Floating light "pills" keep the official logo legible over dark heroes.
  Once the page scrolls, the pills firm up with a soft shadow.

  links:  [{ label, to }] — see SmartLink for supported `to` formats.
  model:  optional model name, so the CTA opens a model-specific enquiry.
*/
export default function SiteHeader({ links, model }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const enquiry = enquiryLink(model);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const classes = ["rn-header", scrolled && "is-scrolled", menuOpen && "is-open"].filter(Boolean).join(" ");

  return (
    <header className={classes}>
      <Link to="/" className="rn-header-logo" aria-label="RENET home" onClick={() => setMenuOpen(false)}>
        <img {...responsiveImage("/renet-logo-transparent.png", "100px")} alt="RENET" width="88" height="52" />
      </Link>

      <nav className="rn-header-nav" id="rn-header-menu" aria-label="Main">
        {links.map(({ label, to }) => (
          <SmartLink key={to} to={to} onClick={() => setMenuOpen(false)}>
            {label}
          </SmartLink>
        ))}
      </nav>

      <div className="rn-header-actions">
        <a className="rn-header-cta" {...enquiry.linkProps}>
          <span className="rn-header-cta-text">Enquire now</span>
          <span aria-hidden="true">↗</span>
        </a>
        <button
          type="button"
          className="rn-header-toggle"
          aria-expanded={menuOpen}
          aria-controls="rn-header-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="rn-burger" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
