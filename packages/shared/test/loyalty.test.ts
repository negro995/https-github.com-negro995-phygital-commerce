import { describe, expect, it } from "vitest";
import { isTierAtLeast, nextTier, tierForTwinCount } from "../src/loyalty";

describe("tierForTwinCount", () => {
  it.each([
    [0, "EXPLORER"],
    [1, "INSIDER"],
    [4, "INSIDER"],
    [5, "VIP"],
    [14, "VIP"],
    [15, "LEGEND"],
    [999, "LEGEND"],
  ])("%i twins -> %s", (count, tier) => {
    expect(tierForTwinCount(count).id).toBe(tier);
  });

  it("treats invalid counts as zero", () => {
    expect(tierForTwinCount(-3).id).toBe("EXPLORER");
    expect(tierForTwinCount(Number.NaN).id).toBe("EXPLORER");
  });
});

describe("nextTier", () => {
  it("reports twins needed for the next tier", () => {
    expect(nextTier(3)).toMatchObject({ tier: { id: "VIP" }, twinsNeeded: 2 });
  });
  it("returns null at the top tier", () => {
    expect(nextTier(20)).toBeNull();
  });
});

describe("isTierAtLeast", () => {
  it("compares tiers by rank", () => {
    expect(isTierAtLeast("VIP", "INSIDER")).toBe(true);
    expect(isTierAtLeast("INSIDER", "VIP")).toBe(false);
  });
});
