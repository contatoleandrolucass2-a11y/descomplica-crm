import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function getDeploymentVersion(rawValue = process.env.DEPLOYMENT_VERSION) {
  return rawValue && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(rawValue) ? rawValue : "unknown";
}

export function GET() {
  return NextResponse.json(
    { status: "ok", version: getDeploymentVersion() },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
