import type { DashboardStageKey } from "@/lib/crm/dashboard/catalog";
import { enforcePermission } from "@/lib/authorization/enforce";
import type { PermissionKey } from "@/lib/authorization/permissions";
import type { ReadModelV3Dataset } from "@/lib/crm/read-model-v3/contracts";
import { loadReadModelV3, type ReadModelV3LoadResult } from "@/lib/crm/read-model-v3/data";
import {
  parseReadModelV3Filters,
  type SearchParameterRecord,
} from "@/lib/crm/read-model-v3/filters";

import { ReadModelV3View } from "./ReadModelV3View";

const DATASET_PERMISSIONS = {
  funnel: "crm.read_model_v3.view",
  ranking: "crm.read_model_v3.ranking.view",
  partnerships: "crm.read_model_v3.partnerships.view",
  stock: "crm.read_model_v3.stock.view",
} as const satisfies Record<ReadModelV3Dataset, PermissionKey>;

export async function ReadModelV3Page({
  action,
  backHref,
  eyebrow,
  title,
  description,
  dataset,
  searchParams = Promise.resolve({}),
  focusStage,
  breakdown,
  policyNotice,
}: {
  action: string;
  backHref?: string;
  eyebrow: string;
  title: string;
  description: string;
  dataset: ReadModelV3Dataset;
  searchParams?: Promise<SearchParameterRecord>;
  focusStage?: DashboardStageKey;
  breakdown?: "organizations" | "brokers" | "managers" | "developments";
  policyNotice?: string;
}) {
  await enforcePermission(DATASET_PERMISSIONS[dataset]);
  const parsed = parseReadModelV3Filters(await searchParams);
  const result: ReadModelV3LoadResult = parsed.ok
    ? await loadReadModelV3(dataset, parsed.selection)
    : { status: "invalid", reason: parsed.reason };

  return (
    <ReadModelV3View
      action={action}
      eyebrow={eyebrow}
      title={title}
      description={description}
      dataset={dataset}
      result={result}
      {...(backHref ? { backHref } : {})}
      {...(focusStage ? { focusStage } : {})}
      {...(breakdown ? { breakdown } : {})}
      {...(policyNotice ? { policyNotice } : {})}
    />
  );
}
