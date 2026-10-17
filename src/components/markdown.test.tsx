import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InlineMarkdown, Markdown } from "./markdown";

const block = (md: string) => renderToStaticMarkup(<Markdown>{md}</Markdown>);
const inline = (md: string) => renderToStaticMarkup(<InlineMarkdown>{md}</InlineMarkdown>);

describe("Markdown fields: problem description, answer text and side note", () => {
  it("renders GitHub-style Markdown, including code blocks and tables", () => {
    const html = block(
      "**Bold** and `code`.\n\n```\npop S\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |",
    );
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<pre><code>pop S\n</code></pre>");
    expect(html).toContain("<table>");
  });

  it("keeps a new line as a line break, as GitHub comments do", () => {
    expect(block("`Hello`\nYo")).toBe(
      '<div class="markdown"><p><code>Hello</code><br/>\nYo</p></div>',
    );
  });

  it("starts a new paragraph after a blank line", () => {
    expect(block("First\n\nSecond")).toBe(
      '<div class="markdown"><p>First</p>\n<p>Second</p></div>',
    );
  });

  it("keeps the lines of a code block as they are", () => {
    expect(block("```\npop S\npop A\n```")).toContain("<pre><code>pop S\npop A\n</code></pre>");
    expect(block("```\npop S\npop A\n```")).not.toContain("<br");
  });

  it("keeps new lines inside a list item", () => {
    expect(block("- Dijkstra\n  needs weights ≥ 0")).toContain("Dijkstra<br/>\nneeds weights ≥ 0");
  });

  it("drops raw HTML", () => {
    const html = block('Hi <script>alert(1)</script><b onclick="x()">there</b>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<b");
  });

  it("drops images written in Markdown: images go in the image fields", () => {
    expect(block("![graph](https://example.com/g.png)")).not.toContain("<img");
  });

  it("opens links in a new tab, safely", () => {
    expect(block("[notes](https://example.edu/algo)")).toContain(
      '<a href="https://example.edu/algo" target="_blank" rel="noopener noreferrer">notes</a>',
    );
  });

  it("refuses javascript: links", () => {
    expect(block("[x](javascript:alert(1))")).not.toContain("javascript:");
  });
});

describe("Inline fields: name and description", () => {
  it("allows inline code, bold and italic, as inline text", () => {
    expect(inline("Binary heap `siftDown`")).toBe(
      'Binary heap <code class="font-mono">siftDown</code>',
    );
    expect(inline("A **bold** and *italic* name")).toBe(
      "A <strong>bold</strong> and <em>italic</em> name",
    );
  });

  it("keeps the text of anything else but drops its formatting", () => {
    expect(inline("# Heading with [a link](https://x.y)")).toBe("Heading with a link");
    expect(inline("<i>raw</i> text")).toBe("raw text");
  });
});
