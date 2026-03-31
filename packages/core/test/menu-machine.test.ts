import { describe, expect, it } from "vitest";
import { createStartedMenuActor, snapshotMenu } from "../src/menu-machine";

describe("MenuMachine", () => {
  it("boots into home on M", () => {
    const actor = createStartedMenuActor();
    actor.send({ type: "m" });

    expect(snapshotMenu(actor).screen).toBe("Home");
  });

  it("cycles cards and enters the selected page", () => {
    const actor = createStartedMenuActor();
    actor.send({ type: "m" });
    actor.send({ type: "down" });
    actor.send({ type: "m" });

    expect(snapshotMenu(actor).screen).toBe("LocationDetail");
  });

  it("toggles tracking from a long press on M", () => {
    const actor = createStartedMenuActor();
    actor.send({ type: "m" });
    actor.send({ type: "m", longPress: true });

    expect(snapshotMenu(actor).trackingActive).toBe(true);
    expect(snapshotMenu(actor).screen).toBe("Home");
  });
});
