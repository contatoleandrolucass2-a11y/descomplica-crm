import { describe, expect, it } from "vitest";

import { DEFAULT_POINT_WEIGHTS } from "../lib/crm/points/catalog";
import { buildRanking, type RankingActivity } from "../lib/crm/ranking/presentation";

const activities: RankingActivity[] = [
  {
    periodKey: "month",
    brokerKey: "ana",
    brokerName: "Ana",
    managerName: "Gerente A",
    roulette: 2,
    rouletteSaturday: 1,
    rouletteSunday: 0,
    schedule: 10,
    visit: 5,
    approvedFolder: 2,
    sale: 1,
  },
  {
    periodKey: "month",
    brokerKey: "bia",
    brokerName: "Bia",
    managerName: "Gerente A",
    roulette: 1,
    rouletteSaturday: 0,
    rouletteSunday: 0,
    schedule: 8,
    visit: 4,
    approvedFolder: 1,
    sale: 0,
  },
  {
    periodKey: "today",
    brokerKey: "ana",
    brokerName: "Ana",
    managerName: "Gerente A",
    roulette: 0,
    rouletteSaturday: 0,
    rouletteSunday: 0,
    schedule: 1,
    visit: 1,
    approvedFolder: 0,
    sale: 0,
  },
];

describe("ranking presentation", () => {
  it("calculates base score, conversion bonus and total", () => {
    const [ana] = buildRanking(activities, "month", "brokers", DEFAULT_POINT_WEIGHTS);
    expect(ana?.baseScore).toBe(67);
    expect(ana?.bonus).toBe(33);
    expect(ana?.total).toBe(100);
    expect(ana?.conversion).toBe(0.5);
  });

  it("orders brokers by computed score", () => {
    expect(
      buildRanking(activities, "month", "brokers", DEFAULT_POINT_WEIGHTS).map((line) => line.name),
    ).toEqual(["Ana", "Bia"]);
  });

  it("aggregates managers without double-counting members", () => {
    const [manager] = buildRanking(activities, "month", "managers", DEFAULT_POINT_WEIGHTS);
    expect(manager?.memberCount).toBe(2);
    expect(manager?.schedule).toBe(18);
    expect(manager?.visit).toBe(9);
  });

  it("filters the selected presentation period", () => {
    const [today] = buildRanking(activities, "today", "brokers", DEFAULT_POINT_WEIGHTS);
    expect(today?.schedule).toBe(1);
    expect(today?.total).toBe(16);
  });
});
