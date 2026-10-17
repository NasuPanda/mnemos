import { useEffect } from "react";
import { HistoryPanel } from "@/components/history/history-panel";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { Toaster } from "@/components/ui/sonner";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { navigate, useLocation } from "@/lib/router";
import { matchRoute } from "@/lib/routes";
import { FlashStartScreen } from "@/screens/flash-start";
import { ItemEditorScreen } from "@/screens/item-editor";
import { ItemsScreen } from "@/screens/items";
import { ReviewScreen } from "@/screens/review";
import { SettingsScreen } from "@/screens/settings";
import { TodayScreen } from "@/screens/today";

export default function App() {
  const { path } = useLocation();
  const route = matchRoute(path);
  const desktop = useMediaQuery(DESKTOP);
  const known = route.screen !== "unknown";

  useEffect(() => {
    if (!known) navigate("/", { replace: true });
  }, [known]);

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
      {/* On phones the Undo pop-up sits at the top, so it never covers Show answer. */}
      {/* On desktop it sits above the rating buttons, never over them. */}
      <Toaster
        position={desktop ? "bottom-center" : "top-center"}
        offset={desktop ? { bottom: 140 } : undefined}
      />
    </>
  );
}
