import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, estimateCosts, validateInputs } from "./runningCost.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("hand-checked example with the default assumptions", () => {
  const r = estimateCosts(DEFAULTS);
  // 25 km × 26 days = 650 km/month
  assert.equal(r.monthlyKm, 650);
  // 30 Wh/km ÷ 0.9 = 0.03333 kWh/km from the wall × ₹8 = ₹0.2667/km
  close(r.electric.perKm, (0.03 / 0.9) * 8);
  close(r.electric.monthly, (0.03 / 0.9) * 8 * 650); // ≈ ₹173.33
  // Petrol: ₹100 ÷ 45 km/l = ₹2.222/km × 650 ≈ ₹1,444.44
  close(r.petrol.monthly, (100 / 45) * 650);
  close(r.difference.yearly, ((100 / 45) - (0.03 / 0.9) * 8) * 650 * 12);
  close(r.kWhPerMonth, (0.03 / 0.9) * 650);
});

test("zero charging loss and scaling behave linearly", () => {
  const base = estimateCosts({ ...DEFAULTS, chargingLossPct: 0 });
  close(base.electric.perKm, 0.03 * 8);
  const double = estimateCosts({ ...DEFAULTS, chargingLossPct: 0, dailyKm: 50 });
  close(double.electric.monthly, base.electric.monthly * 2);
});

test("rejects empty, non-numeric and out-of-range inputs", () => {
  assert.deepEqual(validateInputs(DEFAULTS), {});
  const errors = validateInputs({ ...DEFAULTS, dailyKm: "", tariff: "abc", chargingLossPct: 90, petrolKmPerL: 0 });
  assert.deepEqual(Object.keys(errors).sort(), ["chargingLossPct", "dailyKm", "petrolKmPerL", "tariff"]);
});
