// Run with `npm test`. Locks in the planner sanity checks from CLAUDE.md.
process.env.TZ = "America/New_York"; // DST-sensitive date math must be tested in a DST zone

import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, envCheck, lightCheck, flipHeight, addDays, daysBetween, parseDay, toDayStr, scanForecast, newGrow } from "../src/planner.js";

const grow = (fields) => ({ ...newGrow(), startDate: "2026-06-01", ...fields });
const harvestDay = (g) => daysBetween(parseDay(g.startDate), plan(g).harvestDate);

test("auto, standard speed: harvest on day 77", () => {
  assert.equal(harvestDay(grow({ plantType: "auto", autoSpeed: "standard" })), 77);
});

test("photo hybrid, 4 weeks veg: harvest on day 105", () => {
  assert.equal(harvestDay(grow({ plantType: "photo", genetics: "hybrid", vegWeeks: 4 })), 105);
});

test("a real flip date re-times the harvest", () => {
  assert.equal(harvestDay(grow({ plantType: "photo", genetics: "hybrid", vegWeeks: 4, flipDate: "2026-07-01" })), 30 + 63);
});

test("a nonsense 'days from seed' (0, negative, huge) falls back to the speed choice", () => {
  for (const breederDays of [0, -5, 5000, "abc"]) {
    assert.equal(harvestDay(grow({ plantType: "auto", autoSpeed: "standard", breederDays })), 77);
  }
  assert.equal(harvestDay(grow({ plantType: "auto", breederDays: 70 })), 70);
});

test("negative watts or tent size give no light check instead of a negative number", () => {
  assert.equal(lightCheck({ tentW: 4, tentL: 4, lightWatts: -480 }), null);
  assert.equal(lightCheck({ tentW: -4, tentL: 4, lightWatts: 480 }), null);
});

test("75°F / 55% RH gives leaf VPD ≈ 1.0 kPa", () => {
  assert.ok(Math.abs(envCheck("lateVeg", 75, 55).vpd - 1.0) < 0.1);
});

test("flower RH over 60% is flagged as bud-rot risk", () => {
  assert.ok(envCheck("midFlower", 75, 65).issues.some(([lvl, msg]) => lvl === "bad" && msg.includes("bud-rot")));
});

test("480 W in a 4×4 tent = 30 W/sq ft", () => {
  assert.equal(lightCheck({ tentW: 4, tentL: 4, lightWatts: 480 }).wpsf, 30);
});

test("72-inch tent, 5 gal, hybrid: flip at 15 inches", () => {
  assert.equal(flipHeight({ plantType: "photo", location: "indoor", tentHeight: 72, potGal: 5, genetics: "hybrid" }), 15);
});

test("adding days across the November DST change never shifts the date", () => {
  assert.equal(toDayStr(addDays(parseDay("2026-10-30"), 5)), "2026-11-04");
  assert.equal(daysBetween(parseDay("2026-10-30"), parseDay("2026-11-04")), 5);
});

test("rising amber between scans projects a harvest date", () => {
  const scans = [
    { createdAt: "2026-08-01T12:00:00", reading: { amber: 5 } },
    { createdAt: "2026-08-03T12:00:00", reading: { amber: 9 } },
  ];
  const fc = scanForecast(scans, "balanced"); // target 15% → 6 more points at 2/day = 3 days
  assert.equal(toDayStr(fc.date), "2026-08-06");
});
