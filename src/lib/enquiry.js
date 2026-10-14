// Official RENET contact routes. The WhatsApp number comes from
// VITE_WHATSAPP_NUMBER in .env.local (digits only, with country code).
export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER || "").replace(/\D/g, "");
export const ENQUIRY_EMAIL = "info@renet.in";

export function whatsAppUrl(message) {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function emailUrl(subject) {
  return `mailto:${ENQUIRY_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/*
  Best available enquiry route for a model (or a general D-8 enquiry when no
  model is given): WhatsApp click-to-chat when the
  official number is configured, otherwise email. `linkProps` spreads onto an <a>.
*/
export function enquiryLink(modelName) {
  const message = modelName
    ? `Hi RENET, I'd like to enquire about the ${modelName}.`
    : "Hi RENET, I'd like to know more about the D-8 electric scooter.";
  const whatsApp = whatsAppUrl(message);
  if (whatsApp) {
    return {
      channel: "whatsapp",
      linkProps: { href: whatsApp, target: "_blank", rel: "noopener noreferrer" },
    };
  }
  return {
    channel: "email",
    linkProps: { href: emailUrl(modelName ? `${modelName} enquiry` : "RENET D-8 enquiry") },
  };
}
