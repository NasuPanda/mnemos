import { Fragment, useEffect, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { hasTaggedCodeBlock, loadedHighlighting, loadHighlighting } from "@/lib/highlight";
import { cn } from "@/lib/utils";

/**
 * Links open in a new tab and never count as the tap that reveals the answer. Images inside
 * Markdown are dropped: images belong in the image fields.
 */
const linkAndImage: Components = {
  a: ({ href, title, children }) => (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  ),
  img: () => null,
};

/**
 * GitHub-style Markdown for the problem description, answer text and side note: code blocks,
 * lists and tables, but no raw HTML, no Markdown images and no math. As in GitHub comments, a
 * new line is a line break; a blank line starts a new paragraph. A code block that names its
 * language is highlighted, tone-on-tone, once the highlighter has loaded.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  const highlighting = useHighlighting(children);
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={highlighting ?? undefined}
        skipHtml
        disallowedElements={["img"]}
        components={linkAndImage}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** The highlighter, fetched the first time a field shows a code block that names its language. */
function useHighlighting(markdown: string) {
  const needed = hasTaggedCodeBlock(markdown);
  const [plugins, setPlugins] = useState(loadedHighlighting);
  useEffect(() => {
    if (!needed || plugins) return;
    let live = true;
    void loadHighlighting().then((loaded) => live && setPlugins(loaded));
    return () => {
      live = false;
    };
  }, [needed, plugins]);
  return needed ? plugins : null;
}

const INLINE = ["p", "strong", "em", "code"];

/** The name and the description: inline code, bold and italic only, as plain inline text. */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      allowedElements={INLINE}
      unwrapDisallowed
      skipHtml
      components={{
        p: ({ children: text }: { children?: ReactNode }) => <Fragment>{text}</Fragment>,
        code: ({ children: code }: { children?: ReactNode }) => (
          <code className="font-mono">{code}</code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
