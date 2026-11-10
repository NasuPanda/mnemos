import type { AnchorHTMLAttributes } from "react";
import { navigateAsking, useLocation, withBase } from "@/lib/router";

/**
 * A link that changes screens without reloading the page; modified clicks still open tabs.
 * `replace` swaps the history entry instead of adding one, so Back skips it. A screen with
 * unsaved changes asks before the link leaves it. In the practice day, `to` stays under its base.
 */
export function Link({
  to,
  replace = false,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean }) {
  const { base } = useLocation();
  return (
    <a
      {...props}
      href={withBase(to, base)}
      onClick={(event) => {
        onClick?.(event);
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || modified || event.button !== 0) return;
        event.preventDefault();
        navigateAsking(to, { replace });
      }}
    />
  );
}
