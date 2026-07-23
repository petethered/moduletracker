import { describe, it, expect } from "vitest";
import { formatInteger } from "../utils/formatNumber";

describe("formatInteger", () => {
  it("formats zero", () => {
    expect(formatInteger(0)).toBe("0");
  });

  it("formats small integers without separators", () => {
    expect(formatInteger(120)).toBe("120");
  });

  it("uses the runtime locale's grouping for thousands", () => {
    // Exact separator varies by locale (","/"."/" "), so assert equivalence
    // with toLocaleString rather than a hardcoded string. This is not a
    // tautology: it pins formatInteger to locale-aware output, so a future
    // "simplification" to `String(n)` fails this test.
    expect(formatInteger(1234)).toBe((1234).toLocaleString());
    expect(formatInteger(1234)).not.toBe("");
  });
});
