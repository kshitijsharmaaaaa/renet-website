import { whatsAppUrl } from "../lib/enquiry";

// Hidden until the official number is set via VITE_WHATSAPP_NUMBER (.env.local).
const DEFAULT_MESSAGE = "Hi RENET, I'd like to know more about the D-8 electric scooter.";

export default function WhatsAppButton({ hidden = false }) {
  const href = whatsAppUrl(DEFAULT_MESSAGE);
  if (!href) return null;

  return (
    <a
      className={hidden ? "renet-whatsapp renet-whatsapp-hidden" : "renet-whatsapp"}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with RENET on WhatsApp"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M16.04 3C8.86 3 3.02 8.83 3.02 16c0 2.3.6 4.53 1.74 6.5L3 29l6.68-1.75A13 13 0 0 0 16.04 29C23.21 29 29 23.17 29 16S23.21 3 16.04 3Zm0 23.8c-1.98 0-3.92-.53-5.61-1.54l-.4-.24-3.96 1.04 1.06-3.86-.26-.4A10.76 10.76 0 0 1 5.24 16c0-5.95 4.85-10.79 10.8-10.79 5.94 0 10.76 4.84 10.76 10.79 0 5.96-4.82 10.8-10.76 10.8Zm5.92-8.08c-.32-.16-1.92-.95-2.22-1.06-.3-.11-.51-.16-.73.16-.21.32-.84 1.06-1.03 1.27-.19.22-.38.24-.7.08-.33-.16-1.38-.51-2.62-1.62-.97-.86-1.62-1.93-1.81-2.25-.19-.33-.02-.5.14-.66.15-.15.33-.38.49-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.57-.08-.16-.73-1.76-1-2.41-.26-.63-.53-.55-.73-.56h-.62c-.21 0-.56.08-.86.4-.3.33-1.13 1.11-1.13 2.7 0 1.6 1.16 3.14 1.32 3.35.16.22 2.28 3.48 5.53 4.88.77.33 1.37.53 1.84.68.78.25 1.48.21 2.04.13.62-.09 1.92-.79 2.19-1.55.27-.76.27-1.41.19-1.55-.08-.13-.3-.21-.62-.37Z"
        />
      </svg>
      <span className="renet-whatsapp-label">WhatsApp</span>
    </a>
  );
}
