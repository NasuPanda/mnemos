import { describe, expect, it } from "vitest";
import { wrapInCode } from "./code-wrap";

const wrap = (text: string) => {
  // "[" and "]" mark the selection in these examples.
  const start = text.indexOf("[");
  const end = text.indexOf("]") - 1;
  const plain = text.replace("[", "").replace("]", "");
  const result = wrapInCode(plain, start, end);
  return (
    result.value.slice(0, result.selectionStart) +
    "[" +
    result.value.slice(result.selectionStart, result.selectionEnd) +
    "]" +
    result.value.slice(result.selectionEnd)
  );
};

describe("The Code button", () => {
  it("wraps the selected words in backticks and keeps them selected", () => {
    expect(wrap("Binary heap [siftDown] in O(log n)")).toBe("Binary heap `[siftDown]` in O(log n)");
  });

  it("leaves the cursor between two backticks when nothing is selected", () => {
    expect(wrap("Use []")).toBe("Use `[]`");
  });

  it("turns a selection over several lines into a fenced code block", () => {
    expect(wrap("Trace:\n[pop S\npop A]\nDone")).toBe("Trace:\n```\n[pop S\npop A]\n```\nDone");
  });

  it("puts the fences on their own lines in the middle of a line", () => {
    expect(wrap("Trace: [pop S\npop A] done")).toBe("Trace: \n```\n[pop S\npop A]\n```\n done");
  });

  it("doesn't add blank lines at the start or end of the text", () => {
    expect(wrap("[a\nb]")).toBe("```\n[a\nb]\n```");
  });
});
