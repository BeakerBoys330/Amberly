// Run with `npm test`. Guards the color rules and the bundled strain list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyPixel } from "../src/trichomes.js";

test("vivid orange pistil hairs are never counted as amber", () => {
  assert.equal(classifyPixel(210, 100, 30), null);
});

test("green leaf is ignored", () => {
  assert.equal(classifyPixel(60, 140, 50), null);
});

test("muted golden resin reads as amber", () => {
  assert.equal(classifyPixel(180, 150, 90), "amber");
});

test("bright opaque white reads as milky", () => {
  assert.equal(classifyPixel(225, 225, 220), "milky");
});

test("see-through grey reads as clear", () => {
  assert.equal(classifyPixel(140, 140, 145), "clear");
});

test("strain list: unique ids, known types, no third-party image links", () => {
  const { strains } = JSON.parse(readFileSync(new URL("../src/strain-database.json", import.meta.url), "utf8"));
  assert.equal(new Set(strains.map((s) => s.id)).size, strains.length);
  for (const s of strains) {
    assert.ok(s.name && ["auto", "indica", "hybrid", "sativa"].includes(s.type), s.id);
    assert.equal(s.imageUrl, undefined, s.id);
  }
});
