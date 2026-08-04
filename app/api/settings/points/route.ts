import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pointGoals } from "@/db/schema";

export const dynamic = "force-dynamic";

const settingId = "default";
const metricKeys = ["roulette", "rouletteSaturday", "rouletteSunday", "schedule", "visit", "approvedFolder", "sale"] as const;

const defaultWeights = {
  roulette: 1,
  rouletteSaturday: 2,
  rouletteSunday: 3,
  schedule: 1,
  visit: 7,
  approvedFolder: 4,
  sale: 10,
};

const defaultTargets = {
  roulette: 0,
  rouletteSaturday: 0,
  rouletteSunday: 0,
  schedule: 0,
  visit: 0,
  approvedFolder: 0,
  sale: 0,
};

function parseMetricMap(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const output: Record<(typeof metricKeys)[number], number> = { ...defaultTargets };
  for (const key of metricKeys) {
    const value = Number(source[key]);
    if (!Number.isInteger(value) || value < 0 || value > 100000) return null;
    output[key] = value;
  }
  return output;
}

export async function GET() {
  try {
    const [row] = await getDb().select().from(pointGoals).where(eq(pointGoals.id, settingId)).limit(1);
    if (!row) {
      return Response.json(
        { weights: defaultWeights, targets: defaultTargets, updated_at: null },
        { headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      {
        weights: { ...defaultWeights, ...JSON.parse(row.weightsJson) },
        targets: { ...defaultTargets, ...JSON.parse(row.targetsJson) },
        updated_at: row.updatedAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "points_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const weights = parseMetricMap(body.weights);
  const targets = parseMetricMap(body.targets);
  if (!weights || !targets) return Response.json({ error: "invalid_points" }, { status: 400 });

  const updatedAt = new Date().toISOString();
  try {
    await getDb()
      .insert(pointGoals)
      .values({ id: settingId, weightsJson: JSON.stringify(weights), targetsJson: JSON.stringify(targets), updatedAt })
      .onConflictDoUpdate({
        target: pointGoals.id,
        set: { weightsJson: JSON.stringify(weights), targetsJson: JSON.stringify(targets), updatedAt },
      });
    return Response.json(
      { weights, targets, updated_at: updatedAt },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "points_save_failed" }, { status: 503 });
  }
}
