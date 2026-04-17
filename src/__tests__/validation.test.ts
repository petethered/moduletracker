import { describe, it, expect } from "vitest";
import { validatePullForm, clampPullCount } from "../features/pulls/validation";

describe("validatePullForm", () => {
  it("valid: 7 common, 3 rare, 0 epics", () => {
    expect(validatePullForm(7, 3, 0)).toEqual([]);
  });

  it("valid: 0 common, 0 rare, 10 epics", () => {
    expect(validatePullForm(0, 0, 10)).toEqual([]);
  });

  it("valid: 7 common, 2 rare, 1 epic", () => {
    expect(validatePullForm(7, 2, 1)).toEqual([]);
  });

  it("invalid: sum does not equal 10", () => {
    const errors = validatePullForm(7, 5, 0);
    expect(errors).toContain("Common + Rare + Epics must equal 10");
  });

  it("invalid: negative common", () => {
    const errors = validatePullForm(-1, 3, 8);
    expect(errors).toContain("Common count must be 0-10");
  });

  it("invalid: epic count over 10", () => {
    const errors = validatePullForm(0, 0, 11);
    expect(errors).toContain("Epic count must be 0-10");
  });
});

describe("clampPullCount", () => {
  it("returns 0 for empty string", () => {
    expect(clampPullCount("")).toBe(0);
  });

  it("parses valid integers", () => {
    expect(clampPullCount("7")).toBe(7);
  });

  it("clamps to 0 minimum", () => {
    expect(clampPullCount("-3")).toBe(0);
  });

  it("clamps to 10 maximum", () => {
    expect(clampPullCount("42")).toBe(10);
  });

  it("truncates decimals", () => {
    expect(clampPullCount("7.9")).toBe(7);
  });

  it("returns 0 for non-numeric input", () => {
    expect(clampPullCount("abc")).toBe(0);
  });
});
