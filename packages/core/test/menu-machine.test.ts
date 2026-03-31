import { describe, expect, it } from "vitest";
import { createStartedMenuActor, snapshotMenu } from "../src/menu-machine";

describe("MenuMachine", () => {
  it("boots into home on wake", () => {
    const actor = createStartedMenuActor();
    actor.send({ type: "wake" });

    expect(snapshotMenu(actor).screen).toBe("Home");
  });

  it("cycles cards and enters the selected page", () => {
    const actor = createStartedMenuActor();
    actor.send({ type: "wake" });
    actor.send({ type: "touch.swipe_up" });
    actor.send({ type: "touch.tap" });

    expect(snapshotMenu(actor).screen).toBe("LocationDetail");
  });

  it("toggles tracking from a long press on home", () => {
    const actor = createStartedMenuActor();
    actor.send({ type: "wake" });
    actor.send({ type: "confirm", longPress: true });

    expect(snapshotMenu(actor).trackingActive).toBe(true);
    expect(snapshotMenu(actor).screen).toBe("Home");
  });
});
