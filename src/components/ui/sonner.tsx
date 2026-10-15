import { Toaster as Sonner, type ToasterProps } from "sonner";

// Mnemos is dark-only, so no theme switching (no next-themes); toasts never use colour for
// meaning and never show a spinner.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast gap-3 shadow-raised",
          title: "text-small",
          actionButton: "bg-transparent! text-foreground! text-small! font-bold! px-1! h-8!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
