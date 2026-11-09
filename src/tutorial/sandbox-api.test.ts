import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeApiContract } from "@/lib/api-contract";
import { createSandboxApi } from "./sandbox-api";
import { emptySandbox } from "./sandbox-state";

/** Any request reaching the network is recorded; only me and completeTutorial may. */
let requests: string[] = [];

beforeEach(() => {
  requests = [];
  vi.stubGlobal("fetch", (path: string) => {
    requests.push(path);
    return Promise.resolve(Response.json({ email: "dev@mnemos.local", tutorialCompletedAt: null }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(
    requests.filter((path) => path !== "/api/me" && path !== "/api/tutorial"),
    "the practice copy reached the Worker",
  ).toEqual([]);
});

describeApiContract("the practice copy", async () => createSandboxApi(emptySandbox()));

const KEY = `${"a".repeat(64)}.webp`;

describe("the practice copy", () => {
  it("asks the Worker only who is signed in and to set the tutorial flag", async () => {
    const api = createSandboxApi(emptySandbox());
    await api.me();
    await api.completeTutorial();
    expect(requests).toEqual(["/api/me", "/api/tutorial"]);
  });

  it("shows an uploaded image from its object URL, and lets it go on dispose", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:practice/1");
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const api = createSandboxApi(emptySandbox());

    expect(await api.uploadImage(KEY, new Blob(["x"]))).toEqual({ key: KEY });
    await api.uploadImage(KEY, new Blob(["x"]));
    expect(created).toHaveBeenCalledTimes(1);
    expect(api.imageUrl(KEY)).toBe("blob:practice/1");

    api.dispose();
    expect(revoked).toHaveBeenCalledWith("blob:practice/1");
    expect(api.imageUrl(KEY)).toBe("");
  });

  it("shows the sample data's images from their static files", () => {
    const api = createSandboxApi(emptySandbox(), { [KEY]: "/tutorial/sorted-array.webp" });
    expect(api.imageUrl(KEY)).toBe("/tutorial/sorted-array.webp");
  });

  it("keeps a snapshot apart from the practice day, and starts from a copy of its state", async () => {
    const initial = emptySandbox();
    const api = createSandboxApi(initial);
    await api.createSection({ name: "Hungarian words", code: "HU" });

    expect(initial.sections).toEqual([]);
    const saved = api.snapshot();
    expect(saved.sections.map((s) => s.code)).toEqual(["HU"]);
    expect(saved.settings.nextLine).toBe("m3");

    // A reload picks up from the snapshot.
    const resumed = createSandboxApi(saved);
    expect((await resumed.today("2026-11-09")).sections.map((s) => s.code)).toEqual(["HU"]);
  });

  it("answers with copies, so changing an answer changes nothing", async () => {
    const api = createSandboxApi(emptySandbox());
    const { section } = await api.createSection({ name: "Hungarian words", code: "HU" });
    section.name = "Changed";
    expect((await api.today("2026-11-09")).sections[0]?.name).toBe("Hungarian words");
  });
});
