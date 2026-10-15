import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { addDays, type IsoDate } from "@/core";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { localToday } from "@/lib/today";

const toLocalDate = (date: IsoDate) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/**
 * Pick a date: a popover with a calendar on desktop, a sheet at the bottom on the phone, in
 * thumb reach. Today and the past are disabled; a dot marks where Confident would land.
 */
export function PickDate({
  open,
  onOpenChange,
  today,
  confidentLands,
  picked,
  onPick,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: IsoDate;
  confidentLands: IsoDate;
  picked: IsoDate | null;
  onPick: (date: IsoDate) => void;
  /** The "Pick a date" button the popover hangs from. */
  children: ReactNode;
}) {
  const desktop = useMediaQuery(DESKTOP);
  const tomorrow = toLocalDate(addDays(today, 1));
  const calendar = (
    <div>
      <Calendar
        mode="single"
        required
        weekStartsOn={1}
        defaultMonth={toLocalDate(picked ?? confidentLands)}
        selected={picked ? toLocalDate(picked) : undefined}
        disabled={{ before: tomorrow }}
        modifiers={{ confident: toLocalDate(confidentLands) }}
        modifiersClassNames={{
          confident:
            "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-foreground",
        }}
        onSelect={(date) => {
          if (!date) return;
          onPick(localToday(date));
          onOpenChange(false);
        }}
        autoFocus
        className="p-3 [--cell-size:2.75rem]"
      />
      <p className="px-4 pb-3 text-small text-muted-foreground">
        Dot: where Confident would land. Then rate.
      </p>
    </div>
  );

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverAnchor asChild>{children}</PopoverAnchor>
        <PopoverContent side="top" align="start" className="w-auto rounded-lg p-0 shadow-raised">
          {calendar}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      {children}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <CalendarDays aria-hidden className="size-5" /> Pick the next date
            </DrawerTitle>
            <DrawerDescription>The ladder still moves; only the date is yours.</DrawerDescription>
          </DrawerHeader>
          <div className="flex justify-center pb-[env(safe-area-inset-bottom)]">{calendar}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
