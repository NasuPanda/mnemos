import { describe, expect, it } from "vitest";
import { assignLine, FIRST_LINE, nextLine, suggestCode, validateCode, type Line } from "./sections";

describe("Section colours: a counter cycles M2 red → M3 blue → M4 green", () => {
  it("gives a new account's first section M2", () => {
    expect(FIRST_LINE).toBe("m2");
  });

  it("cycles M2 → M3 → M4 → M2", () => {
    expect(nextLine("m2")).toBe("m3");
    expect(nextLine("m3")).toBe("m4");
    expect(nextLine("m4")).toBe("m2");
  });

  it("colours each new section from the counter and moves the counter on", () => {
    let counter: Line = FIRST_LINE;
    const colours: Line[] = [];
    for (let i = 0; i < 5; i++) {
      const { line, nextLine: next } = assignLine(counter);
      colours.push(line);
      counter = next;
    }
    expect(colours).toEqual(["m2", "m3", "m4", "m2", "m3"]);
  });

  it("never rewinds: deleting or reordering sections doesn't change the next colour", () => {
    // The counter lives in settings, not in the section list, so it only moves forward.
    const afterThree = assignLine(assignLine(assignLine(FIRST_LINE).nextLine).nextLine).nextLine;
    expect(afterThree).toBe("m2");
    expect(assignLine("m3")).toEqual({ line: "m3", nextLine: "m4" }); // the picker's "next colour M3 blue"
  });
});

describe("Section codes › the suggestion from the name", () => {
  it("takes a single word's first three letters (Compilers → COM, page 26)", () => {
    expect(suggestCode("Compilers", [])).toBe("COM");
    expect(suggestCode("Networks", [])).toBe("NET");
  });

  it("takes the initials of two or more words", () => {
    expect(suggestCode("Data structures", [])).toBe("DS");
    expect(suggestCode("Dynamic programming", [])).toBe("DP");
    expect(suggestCode("Machine learning", [])).toBe("ML");
    expect(suggestCode("Theory of computation", [])).toBe("TOC");
  });

  it("uses at most the first three words", () => {
    expect(suggestCode("Advanced data structures and algorithms", [])).toBe("ADS");
  });

  it("counts digits as words (Operating systems 2 → OS2)", () => {
    expect(suggestCode("Operating systems 2", [])).toBe("OS2");
  });

  it("strips accents (Gráfok → GRA)", () => {
    expect(suggestCode("Gráfok", [])).toBe("GRA");
    expect(suggestCode("Gráfelméleti algoritmusok", [])).toBe("GA");
  });

  it("doesn't split camelCase (TypeScript → TYP)", () => {
    expect(suggestCode("TypeScript", [])).toBe("TYP");
  });

  it("treats punctuation and extra spaces as word breaks", () => {
    expect(suggestCode("  linear   algebra & calculus ", [])).toBe("LAC");
    expect(suggestCode("C++", [])).toBe("C2");
  });

  it("keeps a two-letter word whole", () => {
    expect(suggestCode("Go", [])).toBe("GO");
  });

  it("swaps a taken three-letter code's last character for 2–9 (COM → CO2)", () => {
    expect(suggestCode("Compilers", ["COM"])).toBe("CO2");
    expect(suggestCode("Compilers", ["COM", "CO2"])).toBe("CO3");
  });

  it("adds a digit to a taken two-letter code (DS → DS2)", () => {
    expect(suggestCode("Data structures", ["DS"])).toBe("DS2");
  });

  it("compares taken codes without regard to case", () => {
    expect(suggestCode("Compilers", ["com"])).toBe("CO2");
  });

  it("gives a one-letter name a digit (C → C2)", () => {
    expect(suggestCode("C", [])).toBe("C2");
    expect(suggestCode("C", ["C2"])).toBe("C3");
  });

  it("gives no suggestion when the name has no usable letters", () => {
    expect(suggestCode("", [])).toBeNull();
    expect(suggestCode("!!!", [])).toBeNull();
  });

  it("gives no suggestion when every candidate is taken", () => {
    const taken = ["COM", "CO2", "CO3", "CO4", "CO5", "CO6", "CO7", "CO8", "CO9"];
    expect(suggestCode("Compilers", taken)).toBeNull();
  });

  it("always suggests a code that passes validation", () => {
    const names = ["Compilers", "Data structures", "Gráfok", "C", "Operating systems 2", "Go"];
    for (const name of names) {
      const code = suggestCode(name, ["COM", "DS"]);
      expect(code && validateCode(code, ["COM", "DS"]).ok, name).toBe(true);
    }
  });
});

describe("Section codes › the person's own code", () => {
  it("accepts any valid code the person types, even one unrelated to the name", () => {
    expect(validateCode("SQL", ["GR", "DS"])).toEqual({ ok: true, value: "SQL" });
    expect(validateCode("X9", [])).toEqual({ ok: true, value: "X9" });
  });

  it("stores the code in capitals without surrounding spaces", () => {
    expect(validateCode(" sql ", [])).toEqual({ ok: true, value: "SQL" });
  });

  it("needs 2 or 3 characters", () => {
    expect(validateCode("S", [])).toEqual({ ok: false, error: "length" });
    expect(validateCode("SQLX", [])).toEqual({ ok: false, error: "length" });
    expect(validateCode("", [])).toEqual({ ok: false, error: "length" });
  });

  it("allows only A–Z and 0–9", () => {
    expect(validateCode("S-Q", [])).toEqual({ ok: false, error: "characters" });
    expect(validateCode("GRÁ", [])).toEqual({ ok: false, error: "characters" });
    expect(validateCode("A B", [])).toEqual({ ok: false, error: "characters" });
  });

  it("must be unique among the person's sections, regardless of case", () => {
    expect(validateCode("gr", ["GR", "DS"])).toEqual({ ok: false, error: "taken" });
  });

  it("lets a section keep its own code when renamed (its code isn't in the others' list)", () => {
    const others = ["DS", "DP"];
    expect(validateCode("GR", others)).toEqual({ ok: true, value: "GR" });
  });
});
