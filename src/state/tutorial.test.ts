import { afterEach, describe, expect, it, vi } from "vitest";
import type { MnemosApi } from "@/lib/api";

vi.mock("sonner", () => ({ toast: vi.fn() }));

/** A page at `path`, with a history that records where the app sends it. */
function fakeWindow(path: string) {
  const location = { pathname: path, search: "" };
  const go = (_state: unknown, _title: string, url?: string) => {
    if (url) location.pathname = new URL(url, "http://mnemos.local").pathname;
  };
  return {
    location,
    history: { state: null, pushState: vi.fn(go), replaceState: vi.fn(go) },
    addEventListener: () => {},
    matchMedia: () => ({ matches: true }),
  };
}

/** The tutorial controller, fresh for each test, on an API whose flag is `completedAt`. */
async function load(path: string, completedAt: string | null) {
  vi.resetModules();
  const page = fakeWindow(path);
  vi.stubGlobal("window", page);
  const { httpApi, setApi } = await import("@/lib/api");
  const api = {
    ...httpApi,
    me: vi.fn(() => Promise.resolve({ email: "a@b.c", tutorialCompletedAt: completedAt })),
    completeTutorial: vi.fn(() => Promise.resolve()),
  } satisfies MnemosApi;
  setApi(api);
  const tutorial = await import("./tutorial");
  return { page, api, tutorial };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.unstubAllGlobals());

describe("the tutorial's gate", () => {
  it("sends a person who hasn't done it to the practice day", async () => {
    const { page, tutorial } = await load("/", null);
    tutorial.startGate();
    await settle();
    expect(page.location.pathname).toBe("/tutorial");
    expect(page.history.replaceState).toHaveBeenCalled();
  });

  it("leaves a person who has done it where they are", async () => {
    const { page, tutorial } = await load("/items", "2026-11-01T10:00:00.000Z");
    tutorial.startGate();
    await settle();
    expect(page.location.pathname).toBe("/items");
  });
});

describe("leaving the practice day", () => {
  it("sets the flag on the first run, and opens the person's own board", async () => {
    const { page, api, tutorial } = await load("/", null);
    tutorial.startGate();
    await settle();
    tutorial.leaveTutorial("skip");
    await settle();
    expect(api.completeTutorial).toHaveBeenCalledTimes(1);
    expect(page.location.pathname).toBe("/");
  });

  it("asks for the flag first after a reload in the practice day", async () => {
    const { api, tutorial } = await load("/tutorial/items/new", null);
    tutorial.leaveTutorial("finish");
    await settle();
    expect(api.me).toHaveBeenCalled();
    expect(api.completeTutorial).toHaveBeenCalledTimes(1);
  });

  it("never touches the flag after a replay", async () => {
    const { api, tutorial } = await load("/", "2026-11-01T10:00:00.000Z");
    tutorial.startGate();
    await settle();
    tutorial.replayTutorial();
    tutorial.leaveTutorial("skip");
    await settle();
    expect(api.completeTutorial).not.toHaveBeenCalled();
  });
});
