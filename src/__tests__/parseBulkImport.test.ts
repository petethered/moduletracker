import { describe, it, expect } from "vitest";
import { parseBulkImport } from "../features/settings/parseBulkImport";

describe("parseBulkImport", () => {
  it("parses a simple pull with no epics", () => {
    const result = parseBulkImport("3/16/2026\t9\t1");
    expect(result.errors).toEqual([]);
    expect(result.pulls).toHaveLength(1);
    expect(result.pulls[0].date).toBe("2026-03-16");
    expect(result.pulls[0].commonCount).toBe(9);
    expect(result.pulls[0].rareCount).toBe(1);
    expect(result.pulls[0].epicModules).toEqual([]);
    expect(result.pulls[0].gemsSpent).toBe(200);
  });

  it("parses a pull with epics", () => {
    const result = parseBulkImport("3/17/2026\t6\t3\t1\tAmplifying Strike");
    expect(result.errors).toEqual([]);
    expect(result.pulls).toHaveLength(1);
    expect(result.pulls[0].epicModules).toEqual(["amplifying-strike"]);
  });

  it("parses multiple epics", () => {
    const result = parseBulkImport("3/17/2026\t3\t5\t2\tProject Funding\tBlack Hole Digestor");
    expect(result.errors).toEqual([]);
    expect(result.pulls[0].epicModules).toHaveLength(2);
    expect(result.pulls[0].epicModules).toContain("project-funding");
    expect(result.pulls[0].epicModules).toContain("black-hole-digestor");
  });

  it("corrects misspelled names", () => {
    const result = parseBulkImport("3/17/2026\t3\t5\t2\tProject Funding\tBlack Hole Digester");
    expect(result.errors).toEqual([]);
    expect(result.pulls[0].epicModules).toContain("black-hole-digestor");
    expect(result.correctedNames).toHaveLength(1);
    expect(result.correctedNames[0].from).toBe("Black Hole Digester");
    expect(result.correctedNames[0].to).toBe("Black Hole Digestor");
  });

  it("parses multiple lines", () => {
    const text = [
      "3/16/2026\t9\t1",
      "3/17/2026\t6\t3\t1\tDeath Penalty",
      "3/17/2026\t8\t2",
    ].join("\n");
    const result = parseBulkImport(text);
    expect(result.errors).toEqual([]);
    expect(result.pulls).toHaveLength(3);
  });

  it("errors on unknown module", () => {
    const result = parseBulkImport("3/17/2026\t7\t2\t1\tFake Module");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("unknown module");
    expect(result.pulls).toHaveLength(0);
  });

  it("handles trailing empty tabs", () => {
    const result = parseBulkImport("3/16/2026\t9\t1\t\t\t");
    expect(result.errors).toEqual([]);
    expect(result.pulls).toHaveLength(1);
    expect(result.pulls[0].epicModules).toEqual([]);
  });
});
