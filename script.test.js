"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculatePresetYields,
  containsDisallowedMinus,
  deserializePresetStore,
  formatPaymentFrequency,
  isValidNumericDraft,
  normalizePresetName,
  sortPresets,
  upsertPreset,
} = require("./script.js");

function makePreset(id, name, purchasePrice = 1000) {
  return {
    id,
    name,
    normalizedName: normalizePresetName(name),
    updatedAt: "2026-08-08T00:00:00.000Z",
    fields: { purchasePrice },
  };
}

test("normalizePresetName trims whitespace and ignores Russian letter case", () => {
  assert.equal(normalizePresetName("  ОФЗ 26238  "), "офз 26238");
  assert.equal(normalizePresetName(""), "");
  assert.equal(normalizePresetName(null), "");
});

test("containsDisallowedMinus recognizes keyboard minus and typographic dashes", () => {
  assert.equal(containsDisallowedMinus("-"), true);
  assert.equal(containsDisallowedMinus("−"), true);
  assert.equal(containsDisallowedMinus("–"), true);
  assert.equal(containsDisallowedMinus("—"), true);
  assert.equal(containsDisallowedMinus("123,45"), false);
  assert.equal(containsDisallowedMinus(null), false);
});

test("isValidNumericDraft allows a trailing decimal separator while editing", () => {
  assert.equal(isValidNumericDraft("950."), true);
  assert.equal(isValidNumericDraft("950,"), true);
  assert.equal(isValidNumericDraft("950.25"), true);
  assert.equal(isValidNumericDraft(".5"), true);
  assert.equal(isValidNumericDraft(""), true);
  assert.equal(isValidNumericDraft("1 083,22"), true);
  assert.equal(isValidNumericDraft("1\u00a0083,22"), true);
  assert.equal(isValidNumericDraft("1\u202f083,22"), true);
  assert.equal(isValidNumericDraft("950.."), false);
  assert.equal(isValidNumericDraft("950-"), false);
  assert.equal(isValidNumericDraft("abc"), false);
});

test("calculatePresetYields returns coupon and total annual yields for a saved calculation", () => {
  const yields = calculatePresetYields({
    nominal: 1000,
    purchasePrice: 950,
    quantity: 100,
    coupon: 45,
    paymentsPerYear: 2,
    holdToMaturity: "no",
    holdingYears: 5,
    holdingMonths: 0,
    salePrice: 1000,
  });

  assert.ok(yields);
  assert.equal(Number(yields.annualYield.toFixed(2)), 9.47);
  assert.equal(Number(yields.annualYieldWithPrice.toFixed(2)), 10.53);
});

test("formatPaymentFrequency describes the interval between coupon payments", () => {
  assert.equal(formatPaymentFrequency(2), "(каждые 6 месяцев)");
  assert.equal(formatPaymentFrequency(4), "(каждые 3 месяца)");
  assert.equal(formatPaymentFrequency(12), "(каждый месяц)");
  assert.equal(formatPaymentFrequency(5), "(каждые 2,4 месяца)");
});

test("sortPresets sorts Russian names alphabetically without case sensitivity", () => {
  const sorted = sortPresets([
    makePreset("3", "Якорь"),
    makePreset("2", "альфа"),
    makePreset("1", "Бета"),
  ]);

  assert.deepEqual(sorted.map((preset) => preset.name), ["альфа", "Бета", "Якорь"]);
});

test("upsertPreset overwrites a case-insensitive match and preserves its id", () => {
  const items = [
    makePreset("existing", "ОФЗ 26238", 950),
    makePreset("second", "Корпоративная", 900),
  ];
  const updated = upsertPreset(items, makePreset("new-id", "  офз 26238  ", 975));

  assert.equal(updated.length, 2);
  const preset = updated.find((item) => item.normalizedName === "офз 26238");
  assert.equal(preset.id, "existing");
  assert.equal(preset.name, "офз 26238");
  assert.equal(preset.fields.purchasePrice, 975);
});

test("deserializePresetStore returns an empty list for malformed or incompatible data", () => {
  assert.deepEqual(deserializePresetStore("not-json"), []);
  assert.deepEqual(deserializePresetStore('{"version":2,"items":[]}'), []);
  assert.deepEqual(deserializePresetStore('{"version":1,"items":"wrong"}'), []);
});

test("deserializePresetStore drops invalid entries and sorts valid ones", () => {
  const serialized = JSON.stringify({
    version: 1,
    items: [
      makePreset("2", "Ямал"),
      { id: "broken", name: "Без полей" },
      makePreset("1", "Алроса"),
    ],
  });

  assert.deepEqual(
    deserializePresetStore(serialized).map((preset) => preset.name),
    ["Алроса", "Ямал"],
  );
});
