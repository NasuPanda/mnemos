import { describe, expect, it } from "vitest";
import { swipeOf } from "./swipe";

describe("swipeOf", () => {
  it("turns the image on a swipe left or right", () => {
    expect(swipeOf(-80, 0)).toBe("left");
    expect(swipeOf(80, 0)).toBe("right");
  });

  it("closes zoom on a swipe down", () => {
    expect(swipeOf(0, 80)).toBe("down");
  });

  it("ignores a swipe up", () => {
    expect(swipeOf(0, -200)).toBeNull();
  });

  it("ignores short moves, such as a tap that drifts", () => {
    expect(swipeOf(-60, 0)).toBeNull();
    expect(swipeOf(0, 60)).toBeNull();
    expect(swipeOf(5, -3)).toBeNull();
  });

  it("goes by the longer direction when a swipe is slanted", () => {
    expect(swipeOf(70, 200)).toBe("down");
    expect(swipeOf(-200, 70)).toBe("left");
  });
});
