import { describe, expect, it } from "vitest";
import type { MeResponse } from "../contract";
import { signIn, type Session } from "../test/session";

async function completedAt(session: Session): Promise<string | null> {
  const res = await session.get("/api/me");
  return ((await res.json()) as MeResponse).tutorialCompletedAt;
}

describe("PUT /api/tutorial", () => {
  it("marks the tutorial done, which GET /api/me then reports", async () => {
    const mia = await signIn("mia@example.com");
    expect(await completedAt(mia)).toBeNull();

    const res = await mia.put("/api/tutorial", { completed: true });

    expect(res.status).toBe(204);
    expect(await completedAt(mia)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("keeps the first time when it is sent again", async () => {
    const noe = await signIn("noe@example.com");
    await noe.put("/api/tutorial", { completed: true });
    const first = await completedAt(noe);

    const again = await noe.put("/api/tutorial", { completed: true });

    expect(again.status).toBe(204);
    expect(await completedAt(noe)).toBe(first);
  });

  it("refuses any other body and sets nothing", async () => {
    const oli = await signIn("oli@example.com");

    for (const body of [{}, { completed: false }, { completed: "yes" }, [true], null]) {
      expect((await oli.put("/api/tutorial", body)).status).toBe(400);
    }
    expect(await completedAt(oli)).toBeNull();
  });

  it("marks only the signed-in person's tutorial done", async () => {
    const pia = await signIn("pia@example.com");
    const quin = await signIn("quin@example.com");

    await pia.put("/api/tutorial", { completed: true });

    expect(await completedAt(pia)).not.toBeNull();
    expect(await completedAt(quin)).toBeNull();
  });
});
