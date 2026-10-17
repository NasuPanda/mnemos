import { House, List, Play, Plus, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SectionBadge } from "@/components/section-badge";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { Link } from "@/components/link";
import { navigate, useLocation } from "@/lib/router";
import { newItemPath } from "@/lib/routes";
import { useHistoryTarget } from "@/state/history-panel";
import type { SectionDto } from "../../worker/contract";

type Nav = { to: string; label: string; icon: LucideIcon; hint: string; phone: boolean };

const NAV: Nav[] = [
  { to: "/", label: "Today", icon: House, hint: "T", phone: true },
  { to: "/flash", label: "Flash review", icon: Play, hint: "F", phone: false },
  { to: "/items", label: "Items", icon: List, hint: "I", phone: true },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal, hint: ",", phone: true },
];

/**
 * The frame around the work screens: a 248 px sidebar from 1024 px, a tab bar below that.
 * Review mode and the flash review start screen are full-screen and don't use it.
 */
export function AppShell({
  sections,
  lines,
  tabBar = true,
  children,
}: {
  sections: SectionDto[];
  /** Left per section id. */
  lines: Map<number, number>;
  /** Off for full-screen phone screens, like the item editor. */
  tabBar?: boolean;
  children: ReactNode;
}) {
  const { path } = useLocation();
  useHotkeys(
    {
      t: () => navigate("/"),
      i: () => navigate("/items"),
      ",": () => navigate("/settings"),
      n: () => navigate(newItemPath()),
    },
    useHistoryTarget() === null,
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-1">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-md border-[1.5px] border-foreground text-label font-bold"
          >
            M
          </span>
          <span className="text-heading">Mnemos</span>
        </Link>

        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <SidebarLink key={item.to} item={item} active={isCurrent(item, path)} />
          ))}
        </nav>

        <section aria-labelledby="lines-heading" className="flex flex-col gap-1">
          <h2 id="lines-heading" className="px-3 pb-1 text-label text-muted-foreground">
            <Link to="/settings#lines" className="rounded-sm hover:text-foreground">
              Lines
            </Link>
          </h2>
          <ul className="flex flex-col">
            {sections.map((section) => {
              const left = lines.get(section.id) ?? 0;
              return (
                <li key={section.id} className="flex items-center gap-3 rounded-lg px-3 py-1.5">
                  <SectionBadge code={section.code} line={section.line} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-small">{section.name}</span>
                  <span className="font-mono text-meta text-muted-foreground">
                    <span className="sr-only">{left} left</span>
                    <span aria-hidden>{left > 0 ? left : "–"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <Button
          asChild
          variant="secondary"
          className="mt-auto h-12 shrink-0 justify-start gap-3 rounded-lg px-4 text-item font-bold"
        >
          <Link to={newItemPath()}>
            <Plus aria-hidden className="size-5" />
            <span className="flex-1">New item</span>
            <Kbd>N</Kbd>
          </Link>
        </Button>
      </aside>

      <div
        className={cn("min-w-0 lg:pb-0", tabBar && "pb-[calc(4.5rem+env(safe-area-inset-bottom))]")}
      >
        {children}
      </div>

      {tabBar && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {NAV.filter((item) => item.phone).map((item) => {
            const active = isCurrent(item, path);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[4.5rem] flex-col items-center justify-center gap-1 text-label",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <item.icon aria-hidden className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function SidebarLink({ item, active }: { item: Nav; active: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-12 items-center gap-3 rounded-lg px-3 text-item font-semibold",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
      )}
    >
      <item.icon aria-hidden className="size-5" />
      <span className="flex-1">{item.label}</span>
      <Kbd>{item.hint}</Kbd>
    </Link>
  );
}

/** Items stays the current place while an item is open in the editor. */
function isCurrent(item: Nav, path: string): boolean {
  return path === item.to || (item.to === "/items" && path.startsWith("/items/"));
}
