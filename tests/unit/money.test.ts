import { describe, expect, it } from "vitest";
import { formatMinor, minorToMajorString, parseMajorToMinor } from "@/lib/money";

describe("parseMajorToMinor", () => {
  it.each([
    ["2800", 280000],
    ["2,800.50", 280050],
    ["₦ 71,400.5", 7140050],
    ["0.01", 1],
    ["0", 0],
  ])("parses %s → %i kobo", (input, expected) => {
    expect(parseMajorToMinor(input)).toBe(expected);
  });

  it.each(["", "abc", "1.234", "-5", "1e3", "12.3.4"])("rejects %s", (input) => {
    expect(parseMajorToMinor(input)).toBeNull();
  });

  it("does not suffer floating-point drift", () => {
    // 0.1 + 0.2 style issues: 1,000,000.07 must be exact.
    expect(parseMajorToMinor("1000000.07")).toBe(100000007);
  });
});

describe("formatMinor", () => {
  it("formats kobo as naira with exactly two decimals", () => {
    expect(formatMinor(7140050)).toContain("71,400.50");
    expect(formatMinor(5)).toContain("0.05");
  });
  it("returns a dash for missing values", () => {
    expect(formatMinor(null)).toBe("—");
  });
});

describe("minorToMajorString", () => {
  it("round-trips with parseMajorToMinor", () => {
    for (const minor of [1, 99, 100, 280000, 7140050, 123456789]) {
      expect(parseMajorToMinor(minorToMajorString(minor))).toBe(minor);
    }
  });
});
