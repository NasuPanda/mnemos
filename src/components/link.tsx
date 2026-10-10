import type { AnchorHTMLAttributes } from "react";
import { navigate } from "@/lib/router";

/** A link that changes screens without reloading the page; modified clicks still open tabs. */
export function Link({
  to,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      {...props}
      href={to}
      onClick={(event) => {
        onClick?.(event);
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || modified || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
    />
  );
}
