import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-input bg-muted px-4 py-3 text-body text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2 aria-invalid:border-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
