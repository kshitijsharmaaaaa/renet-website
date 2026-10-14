/*
  Running-cost estimator. Pure functions — no RENET figures are hard-coded.

  RENET has not published the D-8's energy consumption, battery capacity or
  range, so energy use per km is a user input. Its default is a general
  assumption for small electric scooters and is labelled as such in the UI.
*/

export const DEFAULTS = {
  dailyKm: 25,
  daysPerMonth: 26,
  whPerKm: 30, // general assumption, NOT an official D-8 figure
  tariff: 8, // ₹ per kWh — example, varies by state and slab
  chargingLossPct: 10, // energy lost while charging — assumption
  petrolKmPerL: 45, // example mileage of the visitor's petrol scooter
  petrolPrice: 100, // ₹ per litre — example, enter your local price
};

export const LIMITS = {
  dailyKm: [1, 300],
  daysPerMonth: [1, 31],
  whPerKm: [5, 150],
  tariff: [0.5, 50],
  chargingLossPct: [0, 40],
  petrolKmPerL: [5, 150],
  petrolPrice: [1, 500],
};

export function validateInputs(inputs) {
  const errors = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const value = Number(inputs[key]);
    if (inputs[key] === "" || !Number.isFinite(value) || value < min || value > max) {
      errors[key] = `Enter a value between ${min} and ${max}.`;
    }
  }
  return errors;
}

export function estimateCosts(inputs) {
  const n = Object.fromEntries(Object.keys(LIMITS).map((key) => [key, Number(inputs[key])]));
  const monthlyKm = n.dailyKm * n.daysPerMonth;
  // Energy drawn from the wall per km, including charging losses.
  const kWhPerKm = n.whPerKm / 1000 / (1 - n.chargingLossPct / 100);
  const electricPerKm = kWhPerKm * n.tariff;
  const petrolPerKm = n.petrolPrice / n.petrolKmPerL;

  const period = (perKm) => ({
    perKm,
    daily: perKm * n.dailyKm,
    monthly: perKm * monthlyKm,
    yearly: perKm * monthlyKm * 12,
  });

  const electric = period(electricPerKm);
  const petrol = period(petrolPerKm);
  return {
    monthlyKm,
    kWhPerMonth: kWhPerKm * monthlyKm,
    electric,
    petrol,
    difference: {
      monthly: petrol.monthly - electric.monthly,
      yearly: petrol.yearly - electric.yearly,
    },
  };
}
