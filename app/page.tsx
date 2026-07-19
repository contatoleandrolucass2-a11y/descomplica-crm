import { DashboardClient } from "./DashboardClient";
import { loadDashboardPageData } from "./dashboard-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const props = await loadDashboardPageData("/");

  return <DashboardClient {...props} />;
}
