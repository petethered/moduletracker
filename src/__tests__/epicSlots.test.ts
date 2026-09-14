import { describe, it, expect } from "vitest";
import { takeSlotForEpic, returnSlotFromEpic } from "../features/pulls/epicSlots";

describe("takeSlotForEpic", () => {
  it("takes the slot from common first (7/3 -> 6/3)", () => {
    expect(takeSlotForEpic({ common: 7, rare: 3 })).toEqual({ common: 6, rare: 3 });
  });

  it("falls back to rare once commons are exhausted (0/10 -> 0/9)", () => {
    expect(takeSlotForEpic({ common: 0, rare: 10 })).toEqual({ common: 0, rare: 9 });
  });

  it("returns null when there is no non-epic drop to convert", () => {
    expect(takeSlotForEpic({ common: 0, rare: 0 })).toBeNull();
  });
});

describe("returnSlotFromEpic", () => {
  it("gives the slot back to common", () => {
    expect(returnSlotFromEpic({ common: 6, rare: 3 })).toEqual({ common: 7, rare: 3 });
  });

  it("is the exact inverse of takeSlotForEpic whenever commons were available", () => {
    for (let common = 1; common <= 10; common++) {
      const start = { common, rare: 10 - common };
      const taken = takeSlotForEpic(start);
      expect(taken).not.toBeNull();
      expect(returnSlotFromEpic(taken!)).toEqual(start);
    }
  });
});
