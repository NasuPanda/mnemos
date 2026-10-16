export type TextEdit = { value: string; selectionStart: number; selectionEnd: number };

/**
 * The phone's Code button: wraps the selection in backticks, which are awkward to type on a
 * phone keyboard. A selection over several lines becomes a fenced code block, each fence on its
 * own line. With nothing selected, it leaves the cursor between a pair of backticks.
 */
export function wrapInCode(value: string, start: number, end: number): TextEdit {
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);

  if (selected.includes("\n")) {
    const open = `${before === "" || before.endsWith("\n") ? "" : "\n"}\`\`\`\n`;
    const close = `\n\`\`\`${after === "" || after.startsWith("\n") ? "" : "\n"}`;
    const inner = selected.replace(/\n$/, "");
    return {
      value: `${before}${open}${inner}${close}${after}`,
      selectionStart: before.length + open.length,
      selectionEnd: before.length + open.length + inner.length,
    };
  }

  return {
    value: `${before}\`${selected}\`${after}`,
    selectionStart: start + 1,
    selectionEnd: end + 1,
  };
}
