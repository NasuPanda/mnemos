import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";

type Me = { email: string };
type State = { status: "loading" } | { status: "ready"; me: Me } | { status: "failed" };

/** Phase 0 placeholder: proves login, the API and D1 work end to end. */
export function SignedIn() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    getJson<Me>("/api/me").then(
      (me) => setState({ status: "ready", me }),
      () => setState({ status: "failed" }),
    );
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-title text-foreground">Mnemos</p>
        {state.status === "ready" && (
          <p className="text-body text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{state.me.email}</span>
          </p>
        )}
        {state.status === "failed" && (
          <p className="text-body text-muted-foreground">
            Couldn’t load your account. Reload the page to try again.
          </p>
        )}
      </div>
    </main>
  );
}
