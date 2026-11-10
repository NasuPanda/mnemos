import { lazy, Suspense, useEffect } from "react";
import { CommandMenu } from "@/components/command-menu";
import { HistoryPanel } from "@/components/history/history-panel";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { Toaster } from "@/components/ui/sonner";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { navigate, useLocation } from "@/lib/router";
import { matchRoute, type Route } from "@/lib/routes";
import { FlashStartScreen } from "@/screens/flash-start";
import { ItemEditorScreen } from "@/screens/item-editor";
import { ItemsScreen } from "@/screens/items";
import { ReviewScreen } from "@/screens/review";
import { SettingsScreen } from "@/screens/settings";
import { TodayScreen } from "@/screens/today";
import { startGate, syncTutorial, tutorialReady, useTutorialMode } from "@/state/tutorial";

/** The practice banner: its code loads with the practice day (src/state/tutorial.ts). */
const PracticeLayer = lazy(() => import("@/tutorial/practice-layer"));

export default function App() {
  const { path, base } = useLocation();
  const route = matchRoute(path);
  const desktop = useMediaQuery(DESKTOP);
  const known = route.screen !== "unknown";
  const mode = useTutorialMode();
  // Screens render only once their API is in place: the practice copy under /tutorial, the
  // Worker's elsewhere. While the practice day loads, nothing shows (no spinner).
  const ready = tutorialReady(base, mode);

  useEffect(() => startGate(), []);
  useEffect(() => syncTutorial(base), [base, mode]);
  useEffect(() => {
    if (!known) navigate("/", { replace: true });
  }, [known]);

  return (
    <>
      {ready && (
        // One boundary, so the screen never shows without the banner above it.
        <Suspense fallback={null}>
          {mode === "practice" && <PracticeLayer />}
          <Screens route={route} />
        </Suspense>
      )}
      {/* On phones the Undo pop-up sits at the top, so it never covers Show answer. */}
      {/* On desktop it sits above the rating buttons, never over them. */}
      <Toaster
        position={desktop ? "bottom-center" : "top-center"}
        offset={desktop ? { bottom: 140 } : undefined}
      />
    </>
  );
}

function Screens({ route }: { route: Route }) {
  return (
    <>
      {route.screen === "today" && <TodayScreen />}
      {route.screen === "flash" && <FlashStartScreen />}
      {route.screen === "review" && <ReviewScreen />}
      {route.screen === "items" && <ItemsScreen />}
      {route.screen === "new-item" && <ItemEditorScreen itemId={null} />}
      {route.screen === "edit-item" && (
        <ItemEditorScreen key={route.itemId} itemId={route.itemId} />
      )}
      {route.screen === "settings" && <SettingsScreen />}
      <HistoryPanel />
      <ShortcutsDialog />
      <CommandMenu />
    </>
  );
}
