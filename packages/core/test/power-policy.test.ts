import { describe, expect, it } from "vitest";
import { PowerPolicyEngine } from "../src/power-policy";

describe("PowerPolicyEngine", () => {
  it("keeps the requested profile when the battery is healthy", () => {
    const decision = PowerPolicyEngine.evaluate("balanced", 76);

    expect(decision.effectiveProfile).toBe("balanced");
    expect(decision.policy.gpsSamplePeriodS).toBe(30);
  });

  it("forces saver mode on low battery", () => {
    const decision = PowerPolicyEngine.evaluate("performance", 20);

    expect(decision.effectiveProfile).toBe("saver");
    expect(decision.reason).toBe("battery-low");
  });

  it("forces emergency mode on critical battery", () => {
    const decision = PowerPolicyEngine.evaluate("performance", 8);

    expect(decision.effectiveProfile).toBe("emergency");
    expect(decision.reason).toBe("battery-critical");
  });
});
