import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { navigate, useLocation } from "@/lib/router";
import { PlaceholderScreen } from "@/screens/placeholder";
import { TodayScreen } from "@/screens/today";

export default function App() {
  const { path } = useLocation();
  const desktop = useMediaQuery(DESKTOP);
  const known = ["/", "/items", "/settings"].includes(path);

  useEffect(() => {
    if (!known) navigate("/", { replace: true });
  }, [known]);

  return (
    <>
      {path === "/" && <TodayScreen />}
      {path === "/items" && (
        <PlaceholderScreen
          title="Items"
          coming="Adding, editing and finding items come in phase 3."
        />
      )}
      {path === "/settings" && (
        <PlaceholderScreen
          title="Settings"
          coming="The ladder editor and your account come in phase 4."
        />
      )}
      {/* On phones the Undo pop-up sits at the top, so it never covers Show answer. */}
      <Toaster position={desktop ? "bottom-center" : "top-center"} />
    </>
  );
}
