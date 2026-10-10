import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useToday } from "@/lib/today";
import { todayView } from "@/state/today-data";
import { useTodayState } from "@/state/today-store";

/** Items and Settings until their phases: the tab is there, the screen says what's coming. */
export function PlaceholderScreen({ title, coming }: { title: string; coming: string }) {
  const state = useTodayState(useToday());
  const data = state.status === "ready" ? state.data : null;
  const lines = useMemo(() => (data ? todayView(data).lines : new Map<number, number>()), [data]);

  return (
    <AppShell sections={data?.sections ?? []} lines={lines}>
      <main className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-10 lg:pt-10">
        <h1 className="text-title">{title}</h1>
        <Empty className="mt-10">
          <EmptyHeader>
            <EmptyTitle>Not built yet</EmptyTitle>
            <EmptyDescription>{coming}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    </AppShell>
  );
}
