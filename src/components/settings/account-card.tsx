import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getJson } from "@/lib/api";

/**
 * Who is signed in, and Sign out. Access owns the session: its logout address ends it, and the
 * next visit asks for Google again. Only works behind Access, not on localhost.
 */
export function AccountCard() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    getJson<{ email: string }>("/api/me")
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
      <Button asChild variant="secondary" className="mt-4 h-12 gap-2 px-5 text-item font-bold">
        {/* A full page load: Access answers this address itself, outside the app. */}
        <a href="/cdn-cgi/access/logout">
          <LogOut aria-hidden className="size-5" />
          Sign out
        </a>
      </Button>
    </section>
  );
}
