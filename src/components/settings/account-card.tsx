import { FlaskConical, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { replayTutorial } from "@/state/tutorial";

/**
 * Who is signed in, Replay tutorial (the phone's one way back to it), and Sign out. Access owns the session: its logout address ends it, and the
 * next visit asks for Google again. Only works behind Access, not on localhost.
 */
export function AccountCard() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    api()
      .me()
      .then((me) => current && setEmail(me.email))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  return (
    <section aria-labelledby="account-title" className="rounded-xl bg-card p-4 shadow-card lg:p-6">
      <h2 id="account-title" className="text-section">
        Account
      </h2>
      <p className="mt-3 text-body text-muted-foreground">
        {email ? (
          <>
            Signed in as <span className="text-foreground">{email}</span> · your items and ladder
            are yours alone.
          </>
        ) : (
          "Your items and ladder are yours alone."
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          className="h-12 gap-2 px-5 text-item font-bold"
          onClick={replayTutorial}
        >
          <FlaskConical aria-hidden className="size-5" />
          Replay tutorial
        </Button>
        <Button asChild variant="secondary" className="h-12 gap-2 px-5 text-item font-bold">
          {/* A full page load: Access answers this address itself, outside the app. */}
          <a href="/cdn-cgi/access/logout">
            <LogOut aria-hidden className="size-5" />
            Sign out
          </a>
        </Button>
      </div>
    </section>
  );
}
