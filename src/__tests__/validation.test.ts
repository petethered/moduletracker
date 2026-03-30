import { describe, it, expect } from "vitest";
import { validatePullForm } from "../features/pulls/validation";

describe("validatePullForm", () => {
  it("valid: 7 common, 3 rare", () => {
    expect(validatePullForm(7, 3)).toEqual([]);
  });

  it("valid: 0 common, 0 rare (10 epics)", () => {
    expect(validatePullForm(0, 0)).toEqual([]);
  });

  it("invalid: common + rare > 10", () => {
    const errors = validatePullForm(7, 5);
    expect(errors).toContain("Common + Rare cannot exceed 10");
  });

  it("invalid: negative common", () => {
    const errors = validatePullForm(-1, 3);
    expect(errors.length).toBeGreaterThan(0);
  });
});
