/*
  Scooter advisor — a guided, rule-based flow that runs entirely in the
  browser (so it works even when the AI is offline).

  It only uses information RENET has published: the two D-8 designs differ in
  look and light signature. Range and price are not published, so the advisor
  never claims a model "covers" a distance or fits a budget — it says what is
  unknown and points the visitor to the team.
*/

export const ADVISOR_STEPS = [
  {
    id: "distance",
    question: "How far is a typical day's riding for you?",
    options: [
      ["short", "Up to 20 km"],
      ["medium", "20–50 km"],
      ["long", "More than 50 km"],
      ["unsure", "Not sure yet"],
    ],
  },
  {
    id: "use",
    question: "What will you mostly use it for?",
    options: [
      ["commute", "College or office"],
      ["errands", "Daily errands"],
      ["journeys", "Longer journeys"],
      ["mixed", "A bit of everything"],
    ],
  },
  {
    id: "look",
    question: "Which look suits you better?",
    options: [
      ["minimal", "Clean and minimal"],
      ["sporty", "Bold and sporty"],
      ["either", "No preference"],
    ],
  },
  {
    id: "budget",
    question: "Is price a deciding factor for you?",
    options: [
      ["price", "Yes, I need the price"],
      ["later", "Not right now"],
    ],
  },
];

const label = (stepId, value) => ADVISOR_STEPS.find((step) => step.id === stepId)?.options.find(([v]) => v === value)?.[1];

const USE_PHRASES = {
  commute: "college or office trips",
  errands: "daily errands",
  journeys: "longer journeys",
  mixed: "a mix of everyday riding",
};

/*
  Returns { models: string[], text: string }.
  `models` lists the model names to attach Enquire / Test ride actions to.
*/
export function recommend(answers) {
  const lines = [];
  let models;

  if (answers.look === "minimal") {
    models = ["D-8 White"];
    lines.push("Your match is the D-8 White: a single-light front and a clean, minimal look for everyday journeys.");
  } else if (answers.look === "sporty") {
    models = ["D-8 Black"];
    lines.push("Your match is the D-8 Black: a double-light front and a bold, sporty look.");
  } else {
    models = ["D-8 White", "D-8 Black"];
    lines.push(
      "Both designs are the RENET D-8, so it comes down to style: the D-8 White is clean and minimal with a single light; the D-8 Black is bold and sporty with a double light.",
    );
  }

  if (USE_PHRASES[answers.use]) {
    lines.push(`For ${USE_PHRASES[answers.use]}, the RENET team can talk you through how the D-8 fits your routine.`);
  }

  if (answers.distance && answers.distance !== "unsure") {
    lines.push(
      `You ride ${label("distance", answers.distance).toLowerCase()} a day. RENET hasn't published the D-8's range yet, so please confirm with the team that it suits your daily distance.`,
    );
  } else {
    lines.push("RENET hasn't published the D-8's range yet — the team can confirm it once you know your daily distance.");
  }

  if (answers.budget === "price") {
    lines.push("Pricing hasn't been published yet; the team will share current pricing when you enquire.");
  }

  lines.push("A test ride is the best way to decide — request one below.");
  return { models, text: lines.join("\n\n") };
}

// Finds which single model an AI reply recommends, so the chat can show actions.
export function detectModel(text) {
  // Tolerate typographic hyphens ("D‑8") that AI models sometimes produce.
  const white = /D[-\u2010-\u2012]8 White/i.test(text);
  const black = /D[-\u2010-\u2012]8 Black/i.test(text);
  if (white && !black) return "D-8 White";
  if (black && !white) return "D-8 Black";
  return null;
}

export const MODEL_SLUGS = { "D-8 White": "d8-white", "D-8 Black": "d8-black" };
