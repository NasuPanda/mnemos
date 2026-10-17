import type { Options } from "react-markdown";

type Plugins = NonNullable<Options["rehypePlugins"]>;

/**
 * A fenced code block that names its language (```ts, ~~~ python). Only those are highlighted;
 * a block without a language, such as pseudo-code, stays plain.
 */
const TAGGED_BLOCK = /^ {0,3}(?:`{3,}|~{3,})[ \t]*[^\s`~]/m;

export function hasTaggedCodeBlock(markdown: string | null | undefined): boolean {
  return !!markdown && TAGGED_BLOCK.test(markdown);
}

let plugins: Plugins | null = null;
let loading: Promise<Plugins> | null = null;

/**
 * Fetches rehype-highlight the first time a field needs it, so the app's main file doesn't
 * carry it. If the fetch fails, the code stays plain and the next field tries again.
 */
export function loadHighlighting(): Promise<Plugins> {
  loading ??= import("rehype-highlight").then(
    ({ default: rehypeHighlight }) => (plugins = [[rehypeHighlight, { detect: false }]]),
    () => {
      loading = null;
      return [];
    },
  );
  return loading;
}

/** The highlighting plugins once loaded, or null before. */
export const loadedHighlighting = (): Plugins | null => plugins;
