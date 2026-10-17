import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { modKey, SHORTCUTS, type ShortcutGroup } from "@/lib/keys";
import { openLayer } from "@/lib/layers";
import { useLocation } from "@/lib/router";
import { closeOverlay, openOverlay, useOverlay } from "@/state/overlay";

/**
 * `?` from anywhere: every shortcut, grouped by where it works. `?` again or Esc closes it. Touch
 * screens have no keys, so nothing opens it there.
 */
export function ShortcutsDialog() {
  const overlay = useOverlay();
  const open = overlay === "shortcuts";
  const { path } = useLocation();

  useHotkeys({
    "?": () => {
      if (open) closeOverlay();
      else if (overlay === null && !openLayer()) openOverlay("shortcuts");
    },
  });
  // Leaving the screen (Back) leaves the list too.
  useEffect(() => closeOverlay(), [path]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeOverlay()}>
      {/* Closes at once, without the fade: keys pressed right after go to the screen. */}
      <DialogContent
        overlayClassName="data-closed:animate-none!"
        className="max-h-[90dvh] max-w-[880px]! gap-6 overflow-y-auto rounded-lg p-6 shadow-overlay data-closed:animate-none!"
      >
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="text-heading">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-small text-muted-foreground">
            Keys work when you aren’t typing in a field. Esc closes this list.
          </DialogDescription>
        </div>
        <ShortcutList groups={SHORTCUTS} mod={modKey()} />
      </DialogContent>
    </Dialog>
  );
}

/** The groups side by side: the keys, then what each does. "Ctrl" shows as ⌘ on a Mac. */
export function ShortcutList({ groups, mod }: { groups: ShortcutGroup[]; mod: string }) {
  return (
    <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <section key={group.where}>
          <h3 className="text-label text-muted-foreground">{group.where}</h3>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5 text-small">
            {group.shortcuts.map((shortcut) => (
              <div key={shortcut.action} className="contents">
                <dt>
                  <KbdGroup>
                    {shortcut.keys.map((key) => (
                      <Kbd key={key}>{key === "Ctrl" ? mod : key}</Kbd>
                    ))}
                  </KbdGroup>
                </dt>
                <dd>{shortcut.action}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
