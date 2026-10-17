import { useRef, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Kbd } from "@/components/ui/kbd";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";

/**
 * A question before something that can't be taken back: a dialog on desktop, a sheet at the
 * bottom on the phone, in thumb reach. Cancel has the focus in both, so a plain Enter (from a
 * keyboard on a tablet too) never confirms. The action is a secondary button, never red.
 * `children` adds more below the description, such as what a removal moves where.
 */
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmIcon,
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const desktop = useMediaQuery(DESKTOP);
  const cancelRef = useRef<HTMLButtonElement>(null);

  if (desktop) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-md! rounded-lg p-6 shadow-overlay">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-heading">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-body text-muted-foreground">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {children}
          <AlertDialogFooter className="m-0 border-0 bg-transparent p-0">
            <AlertDialogCancel className="h-12 gap-2 px-5 text-item font-bold" autoFocus>
              {cancelLabel}
              <Kbd>Esc</Kbd>
            </AlertDialogCancel>
            <Button
              variant="secondary"
              className="h-12 gap-2 px-5 text-item font-bold"
              disabled={busy}
              onClick={onConfirm}
            >
              {confirmIcon}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DrawerHeader className="px-5 pt-4 pb-0 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <DrawerTitle className="text-heading">{title}</DrawerTitle>
          <DrawerDescription className="pt-2 text-body text-muted-foreground">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        {children && <div className="px-5 pt-4">{children}</div>}
        <DrawerFooter className="gap-3 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            variant="secondary"
            className="h-14 w-full gap-2 rounded-full text-item font-bold"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
          <DrawerClose asChild>
            <Button ref={cancelRef} variant="ghost" className="h-12 w-full text-item font-bold">
              {cancelLabel}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
