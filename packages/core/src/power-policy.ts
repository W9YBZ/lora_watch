import { POWER_PROFILE_IDS, type PowerProfileId } from "./protocol";

export type BleMode = "always-on" | "advertising-1s" | "advertising-5s" | "on-demand";

export interface PowerPolicy {
  screenTimeoutS: number;
  gpsSamplePeriodS: number;
  bleMode: BleMode;
  loraReportIntervalS: number;
  deepSleepIdleAfterS: number | null;
}

export interface PowerDecision {
  requestedProfile: PowerProfileId;
  effectiveProfile: PowerProfileId;
  policy: PowerPolicy;
  reason: string;
}

export const POWER_POLICIES: Record<PowerProfileId, PowerPolicy> = {
  performance: {
    screenTimeoutS: 30,
    gpsSamplePeriodS: 5,
    bleMode: "always-on",
    loraReportIntervalS: 30,
    deepSleepIdleAfterS: null
  },
  balanced: {
    screenTimeoutS: 15,
    gpsSamplePeriodS: 30,
    bleMode: "advertising-1s",
    loraReportIntervalS: 120,
    deepSleepIdleAfterS: 60
  },
  saver: {
    screenTimeoutS: 8,
    gpsSamplePeriodS: 120,
    bleMode: "advertising-5s",
    loraReportIntervalS: 600,
    deepSleepIdleAfterS: 20
  },
  emergency: {
    screenTimeoutS: 10,
    gpsSamplePeriodS: 15,
    bleMode: "on-demand",
    loraReportIntervalS: 30,
    deepSleepIdleAfterS: null
  }
};

export const PowerPolicyEngine = {
  resolveEffectiveProfile(requestedProfile: PowerProfileId, batteryPct: number): PowerProfileId {
    if (batteryPct <= 10) {
      return "emergency";
    }

    if (batteryPct <= 25 && (requestedProfile === "performance" || requestedProfile === "balanced")) {
      return "saver";
    }

    return requestedProfile;
  },
  evaluate(requestedProfile: PowerProfileId, batteryPct: number): PowerDecision {
    const effectiveProfile = this.resolveEffectiveProfile(requestedProfile, batteryPct);
    const reason =
      effectiveProfile === requestedProfile
        ? "requested-profile"
        : batteryPct <= 10
          ? "battery-critical"
          : "battery-low";

    return {
      requestedProfile,
      effectiveProfile,
      policy: POWER_POLICIES[effectiveProfile],
      reason
    };
  }
};

export function isPowerProfileId(value: string): value is PowerProfileId {
  return POWER_PROFILE_IDS.includes(value as PowerProfileId);
}
