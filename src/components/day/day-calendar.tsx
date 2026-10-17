import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { IsoDate } from "@/core";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { navigate } from "@/lib/router";
import { dayPath } from "@/lib/routes";
import { localToday } from "@/lib/today";

const toLocalDate = (date: IsoDate) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/**
 * The phone's calendar button: a month in a sheet at the bottom, to go to any day. The week
 * strip only reaches this week; this reaches the rest.
 */
export function DayCalendar({ day, today }: { day: IsoDate; today: IsoDate }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className="size-12 shrink-0 rounded-full"
        aria-label="Go to a day"
        onClick={() => setOpen(true)}
      >
        <CalendarDays aria-hidden className="size-5" />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <CalendarDays aria-hidden className="size-5" /> Go to a day
            </DrawerTitle>
            <DrawerDescription>
              Past days show the reviews done; future days the items due.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Calendar
              mode="single"
              required
              weekStartsOn={1}
              defaultMonth={toLocalDate(day)}
              selected={toLocalDate(day)}
              today={toLocalDate(today)}
              onSelect={(date) => {
                if (!date) return;
                setOpen(false);
                navigate(dayPath(localToday(date), today), { replace: true });
              }}
              autoFocus
              className="p-3 [--cell-size:2.75rem]"
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
