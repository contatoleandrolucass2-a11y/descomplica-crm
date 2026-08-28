import { handleWeekendForecastGet, handleWeekendForecastPost } from "@/lib/crm/dialer/handler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleWeekendForecastGet(request);
}

export async function POST(request: Request) {
  return handleWeekendForecastPost(request);
}
