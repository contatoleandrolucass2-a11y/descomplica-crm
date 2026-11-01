import { describe, expect, it } from "vitest";
import { appointmentsGoalPath } from "@/app/(protected)/app/etapas/_components/AppointmentsColumns";

describe("appointments connected target reference", () => {
  it("connects varying known targets from the first through the last bucket", () => {
    const path = appointmentsGoalPath([2, 5, 1, 0], 100, 10);
    expect(path).toBe("M0,80 H25 V50 H50 V90 H75 V100 H100");
    expect(path.match(/M/gu)).toHaveLength(1);
  });
  it("keeps zero targets at the real zero baseline", () => {
    expect(appointmentsGoalPath([0, 0], 100, 10)).toBe("M0,100 H50 V100 H100");
  });
  it("leaves unknown targets unavailable rather than inventing zero or interpolation", () => {
    expect(appointmentsGoalPath([null, 2, undefined, 3], 100, 10)).toBe("M25,80 H50 M75,70 H100");
    expect(appointmentsGoalPath([null, undefined], 100, 10)).toBe("");
  });
  it("clips goals beyond available space without changing the bar ruler", () => {
    expect(appointmentsGoalPath([22, 4], 100, 10)).toBe("M0,0 H50 V60 H100");
  });
});
