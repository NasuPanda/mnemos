import { Fragment, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
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
 * lists and tables, but no raw HTML, no Markdown images and no math.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["img"]}
        components={linkAndImage}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
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
