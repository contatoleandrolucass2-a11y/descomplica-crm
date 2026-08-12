import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReadModelV3View } from "@/app/(protected)/app/_components/ReadModelV3View";
import { createEmptyReadModelV3Selection } from "@/lib/crm/read-model-v3/filters";

const SCOPE_ID = "10000000-0000-4000-8000-000000000001";
const STAGES = ["opportunities", "appointments", "visits", "folders", "sales"] as const;

describe("read model v3 presentation states", () => {
  it("keeps certified zero breakdowns in the empty state", () => {
    const selection = createEmptyReadModelV3Selection();
    selection.scopeId = SCOPE_ID;

    const markup = renderToStaticMarkup(
      <ReadModelV3View
        action="/app/read-model-v3"
        eyebrow="Read model v3"
        title="Dashboard"
        description="Fonte oficial"
        dataset="funnel"
        result={{
          status: "loaded",
          scopes: [
            {
              scope_id: SCOPE_ID,
              scope_key: "global",
              scope_type: "global",
              scope_label: "Global",
            },
          ],
          selection,
          model: {
            schemaVersion: 3,
            dataStatus: "empty",
            reasonCode: null,
            scopeId: SCOPE_ID,
            datasetKey: "funnel",
            source: {
              sourceKey: "salesforce",
              workflowKey: "official-export-v3",
              producerKey: "crm-relay-v3",
              referenceDate: "2026-08-09",
              generatedAt: "2026-08-09T12:00:00Z",
              sourceUpdatedAt: "2026-08-09T11:59:00Z",
              timezone: "America/Sao_Paulo",
              coverageStart: "2026-08-01",
              coverageEnd: "2026-08-09",
              coverageStatus: "complete",
              sourceStatus: "ready",
              qualityStatus: "verified",
              qualityIssues: [],
            },
            filters: { period: "month" },
            options: {
              organizations: [],
              teams: [],
              portfolios: [],
              coordinators: [],
              managers: [],
              brokers: [],
              origins: [],
              developments: [],
              locations: [],
            },
            truncatedOptions: [],
            metrics: {
              stageTotals: STAGES.map((stageKey, index) => ({
                stageKey,
                value: 0,
                conversion: index === 0 ? null : 0,
                closedMonthsAverage: null,
              })),
              salesAmount: null,
              goalsAvailable: false,
              goal: null,
              planningAvailable: false,
              monthlySeries: [],
            },
            breakdowns: {
              organizations: [],
              brokers: [],
              managers: [],
              developments: [],
            },
          },
        }}
      />,
    );

    expect(markup.match(/data-variant="empty"/g)).toHaveLength(2);
    expect(markup).toContain("Dimensão sem registros");
  });
});
