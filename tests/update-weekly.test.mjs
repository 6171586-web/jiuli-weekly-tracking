import assert from "node:assert/strict";
import test from "node:test";
import { applyValuations, findUnitNav, findValuationDate, parseValuationText } from "../scripts/update-weekly.mjs";
import { mondayOfWeek, shouldUpdate } from "../scripts/should-update.mjs";

test("extracts the fund valuation fields without confusing cumulative NAV", () => {
  const text = "璞理九里一号私募证券投资基金A（BPW63A） 估值日期：2026年8月14日 单位净值：0.9234 累计净值：1.0271 持有份额：1,076,061.60 持仓市值：993,640.29";
  assert.equal(findValuationDate(text), "2026-08-14");
  assert.equal(findUnitNav(text), 0.9234);
  assert.deepEqual(parseValuationText(text), {
    valuationDate: "2026-08-14",
    unitNav: 0.9234,
    totalShares: 1076061.6,
    holdingValue: 993640.29
  });
});

test("adds a new point and moves the latest marker", () => {
  const tracker = {
    mailVerifiedAt: "2026-08-10",
    dividend: { totalShares: 1076061.6 },
    latestEmail: {},
    points: [
      { date: "2026-08-07", unitNav: 0.8979, index: 7679.53, note: "最新净值" }
    ]
  };
  const changed = applyValuations(
    tracker,
    [{ valuationDate: "2026-08-14", unitNav: 0.9234, totalShares: 1076061.6, holdingValue: 993640.29 }],
    { "2026-08-14": 7812.34 },
    "2026-08-17"
  );
  assert.equal(changed, true);
  assert.equal(tracker.points[0].note, undefined);
  assert.equal(tracker.points[1].note, "最新净值");
  assert.equal(tracker.latestEmail.valuationDate, "2026-08-14");
  assert.equal(tracker.mailVerifiedAt, "2026-08-17");
  assert.equal(tracker.lastSuccessfulCheckDate, "2026-08-17");
});

test("skips the second scheduled check after a successful update in the same week", () => {
  assert.equal(mondayOfWeek("2026-08-17"), "2026-08-17");
  assert.equal(mondayOfWeek("2026-08-23"), "2026-08-17");
  assert.equal(shouldUpdate("2026-08-17", "2026-08-17"), false);
  assert.equal(shouldUpdate("2026-08-17", "2026-08-24"), true);
  assert.equal(shouldUpdate(null, "2026-08-17"), true);
});
