import { test } from "node:test";
import assert from "node:assert/strict";
import { ADVISOR_STEPS, detectModel, recommend } from "./advisor.js";

const NUMBERS_OR_PRICES = /(\d+\s?(km\/h|kwh|wh|hours?|hrs?|years?)\b|₹|\brs\.?\s?\d)/i;

test("look preference decides the recommended design", () => {
  assert.deepEqual(recommend({ look: "minimal" }).models, ["D-8 White"]);
  assert.deepEqual(recommend({ look: "sporty" }).models, ["D-8 Black"]);
  assert.deepEqual(recommend({ look: "either" }).models, ["D-8 White", "D-8 Black"]);
});

test("never invents range, price or other figures — for every possible answer combination", () => {
  const [distance, use, look, budget] = ADVISOR_STEPS.map((step) => step.options.map(([value]) => value));
  for (const d of distance) for (const u of use) for (const l of look) for (const b of budget) {
    const { text } = recommend({ distance: d, use: u, look: l, budget: b });
    assert.ok(!NUMBERS_OR_PRICES.test(text.replace(/(Up to 20 km|20–50 km|More than 50 km)/gi, "")), text);
    assert.match(text, /range yet/i, "always states range is unpublished");
    if (b === "price") assert.match(text, /Pricing hasn't been published/);
    assert.match(text, /test ride/i);
  }
});

test("detectModel only returns a model when exactly one is named", () => {
  assert.equal(detectModel("I'd suggest the D-8 Black for you."), "D-8 Black");
  assert.equal(detectModel("the d-8 white is minimal"), "D-8 White");
  assert.equal(detectModel("Both the D-8 White and D-8 Black share the D-8."), null);
  assert.equal(detectModel("Hello!"), null);
  assert.equal(detectModel("the D\u20118 Black suits you"), "D-8 Black", "non-breaking hyphen from AI output");
});
