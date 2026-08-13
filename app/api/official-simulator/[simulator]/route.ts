import {
  handleOfficialSimulatorPost,
  handleOfficialSimulatorStatus,
} from "@/lib/crm/simulators/official/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ simulator: string }> }) {
  const { simulator } = await context.params;
  return handleOfficialSimulatorStatus(request, simulator);
}

export async function POST(request: Request, context: { params: Promise<{ simulator: string }> }) {
  const { simulator } = await context.params;
  return handleOfficialSimulatorPost(request, simulator);
}
