/*
  RENET D-8 product data for the product detail page.

  Only information already published on the RENET website is used here.
  Technical specifications are deliberately listed under `pendingSpecs`
  until RENET confirms them — do not add estimated figures.

  Gallery views reuse the genuine product photographs. "Detail" views are
  lossless crops of the same photo (zoom + focal point), never stretched.
  To add new official photos, drop them in /public and add a view here.
*/

const products = {
  "d8-white": {
    slug: "d8-white",
    id: "01",
    name: "D-8 White",
    shortName: "White",
    color: "white",
    swatch: "#f2f2ee",
    category: "Single Light · Electric Scooter",
    light: "Single light",
    tagline: "A clean, minimal look for everyday journeys.",
    description:
      "Understated in appearance. Distinct in character. Discover the RENET D-8 White and find a look that feels like your own.",
    lightCopy:
      "The D-8 White carries a single-light front — part of a clean, minimal design that lets the form speak for itself.",
    image: "/renet-d8-white.png",
    gallery: [
      { id: "studio", label: "Studio", src: "/renet-d8-white.png", focus: "50% 50%", zoom: 1 },
      { id: "front", label: "Single-light front", src: "/renet-d8-white.png", focus: "36% 55%", zoom: 1.8 },
      { id: "detail", label: "D-8 side detail", src: "/renet-d8-white.png", focus: "63% 62%", zoom: 1.8 },
    ],
    lightView: { src: "/renet-d8-white.png", focus: "36% 55%", zoom: 1.8 },
  },
  "d8-black": {
    slug: "d8-black",
    id: "02",
    name: "D-8 Black",
    shortName: "Black",
    color: "black",
    swatch: "#151614",
    category: "Double Light · Electric Scooter",
    light: "Double light",
    tagline: "A bold, sporty look. Move your own way.",
    description:
      "A bolder expression of everyday mobility. Discover the RENET D-8 Black and explore a design made to stand apart.",
    lightCopy:
      "The D-8 Black's double-light front gives it a bolder, sportier presence — a design made to stand apart.",
    image: "/renet-d8-black.png",
    gallery: [
      { id: "studio", label: "Studio", src: "/renet-d8-black.png", focus: "50% 50%", zoom: 1 },
      { id: "front", label: "Double-light front", src: "/renet-contact.png", focus: "25% 60%", zoom: 1 },
      { id: "detail", label: "D-8 side detail", src: "/renet-d8-black.png", focus: "62% 62%", zoom: 1.8 },
    ],
    lightView: { src: "/renet-contact.png", focus: "25% 60%", zoom: 1 },
  },
};

export const productOrder = ["d8-white", "d8-black"];

// Shown as "Awaiting official confirmation" — matches the live website.
export const pendingSpecs = [
  { group: "Performance", label: "Certified range" },
  { group: "Performance", label: "Top speed" },
  { group: "Performance", label: "Motor" },
  { group: "Energy", label: "Battery capacity" },
  { group: "Energy", label: "Charging time" },
  { group: "Ownership", label: "Warranty" },
  { group: "Ownership", label: "Price" },
];

export const faqs = [
  {
    question: "What is the difference between the D-8 White and the D-8 Black?",
    answer:
      "Both are RENET D-8 electric scooters. The D-8 White has a single-light front and a clean, minimal look. The D-8 Black has a double-light front and a bold, sporty look. RENET hasn't published any other technical differences yet.",
  },
  {
    question: "What is the price of the D-8?",
    answer:
      "Pricing hasn't been published yet. Send an enquiry and the RENET team will share current pricing and availability with you directly.",
  },
  {
    question: "What range, top speed and battery does the D-8 have?",
    answer:
      "Official figures for range, top speed, battery capacity, charging time, motor and warranty are awaiting confirmation. RENET only publishes verified figures, so please contact the team for the latest confirmed details.",
  },
  {
    question: "Which colours are available?",
    answer:
      "The website currently shows two designs: D-8 White and D-8 Black. Availability of each design should be confirmed with RENET.",
  },
  {
    question: "How do I make an enquiry?",
    answer:
      "Tap “Enquire now” to message RENET, email info@renet.in, or use the contact form on the homepage. Choose the model you're interested in and the team will follow up about availability and your questions.",
  },
];

export default products;
