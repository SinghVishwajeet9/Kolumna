import { describe, expect, it } from "vitest";
import { calculateRank } from "../src/services/ranking.js";

describe("calculateRank", () => {
  it("returns 1.0 for the first card in an empty list", () => {
    expect(calculateRank(null, null)).toBe(1.0);
  });

  it("halves the following rank when dropped at the start", () => {
    expect(calculateRank(null, 2.0)).toBe(1.0);
  });

  it("adds 1 to the preceding rank when dropped at the end", () => {
    expect(calculateRank(3.0, null)).toBe(4.0);
  });

  it("takes the midpoint when dropped between two cards", () => {
    expect(calculateRank(1.0, 2.0)).toBe(1.5);
  });
});
