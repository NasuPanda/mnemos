import { Code, TriangleAlert } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { wrapInCode, type TextEdit } from "@/editor/code-wrap";
import { describedBy } from "@/editor/form";

/**
 * A labelled field: "Name  Required", the control, then one line of help or, after a refused
 * save, the problem: an alert icon and a plain sentence, never red.
 */
export function EditorField({
  label,
  htmlFor,
  required = false,
  help,
  error,
  actions,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  /** Controls at the right of the label: the Code button, Write / Preview. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-8 items-end justify-between gap-3">
        <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-label">
          {label}
          {required && <span className="font-normal text-muted-foreground">Required</span>}
        </label>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-problem`}
          className="flex items-start gap-1.5 text-small font-bold text-foreground"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : (
        help && (
          <p id={`${htmlFor}-help`} className="text-small text-muted-foreground">
            {help}
          </p>
        )
      )}
    </div>
  );
}

type TextControl = HTMLInputElement | HTMLTextAreaElement;

/**
 * On touch screens only: wraps the selection in backticks, which are awkward to type on a phone
 * keyboard. It never takes the focus, so the keyboard stays open.
 */
export function CodeButton({
  target,
  onEdit,
}: {
  target: RefObject<TextControl | null>;
  onEdit: (value: string) => void;
}) {
  const apply = () => {
    const control = target.current;
    if (!control) return;
    const edit: TextEdit = wrapInCode(
      control.value,
      control.selectionStart ?? control.value.length,
      control.selectionEnd ?? control.value.length,
    );
    onEdit(edit.value);
    requestAnimationFrame(() => {
      control.focus();
      control.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };
  return (
    <Button
      type="button"
      variant="secondary"
      onPointerDown={(event) => event.preventDefault()}
      onClick={apply}
      className="hidden h-9 gap-1.5 rounded-md px-3 text-label [@media(hover:none)_and_(pointer:coarse)]:inline-flex"
    >
      <Code aria-hidden className="size-4" />
      Code
    </Button>
  );
}

/** A textarea that grows with its text, where the browser can't do it with CSS alone. */
export function GrowingTextarea({
  ref,
  value,
  className,
  ...props
}: React.ComponentProps<typeof Textarea> & {
  value: string;
  ref?: RefObject<HTMLTextAreaElement | null>;
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const control = ref ?? own;
  useLayoutEffect(() => {
    const element = control.current;
    if (!element || CSS.supports("field-sizing", "content")) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [control, value]);
  return (
    <Textarea
      ref={control}
      value={value}
      className={cn("resize-none overflow-hidden", className)}
      {...props}
    />
  );
}

/**
 * Problem description, answer text and side note: Markdown, with a Write / Preview toggle that
 * shows it as review will.
 */
export function MarkdownField({
  id,
  label,
  value,
  onChange,
  help,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  error?: string;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <EditorField
      label={label}
      htmlFor={id}
      help={help}
      error={error}
      actions={
        <>
          {mode === "write" && <CodeButton target={ref} onEdit={onChange} />}
          <ToggleGroup
            type="single"
            aria-label={`${label}: write or preview`}
            value={mode}
            onValueChange={(next) => next && setMode(next as "write" | "preview")}
            spacing={0}
            className="rounded-md bg-muted p-0.5"
          >
            {(["write", "preview"] as const).map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className="h-8 rounded-[7px]! px-3 text-label text-muted-foreground data-[state=on]:bg-secondary data-[state=on]:text-foreground max-lg:h-9"
              >
                {option === "write" ? "Write" : "Preview"}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </>
      }
    >
      {mode === "write" ? (
        <GrowingTextarea
          ref={ref}
          id={id}
          value={value}
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(id, error, !!help)}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-28"
        />
      ) : (
        <div
          id={id}
          tabIndex={0}
          aria-label={`${label}, preview`}
          className="min-h-28 rounded-md border border-border bg-background px-4 py-3"
        >
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-body text-subtle-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </EditorField>
  );
}
