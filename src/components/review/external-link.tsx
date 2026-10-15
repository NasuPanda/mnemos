import { ExternalLink as ExternalIcon, Link2 } from "lucide-react";
import { shortUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A problem or answer link: opens in a new tab and never reveals the answer. */
export function ExternalLink({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-no-reveal
      onClick={(event) => event.stopPropagation()}
      className={cn("inline-flex max-w-full items-center gap-2 text-body", className)}
    >
      <Link2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate underline underline-offset-4">{shortUrl(url)}</span>
      <ExternalIcon aria-hidden className="size-4 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
