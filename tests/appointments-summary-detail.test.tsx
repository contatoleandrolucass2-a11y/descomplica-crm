import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeAppointments, type AppointmentFilters } from "@/lib/crm/stages/appointments";
import {
  compactAppointmentSummary,
  expandAppointmentSummary,
} from "@/lib/crm/stages/appointments-summary";
import {
  appointmentDetailPage,
  appointmentDetailsCsv,
  appointmentSnapshotIdentity,
  initialAppointmentDetailPage,
} from "@/lib/crm/stages/appointments-detail-server";
import {
  appointmentDetailQueryKey,
  type AppointmentDetailQuery,
} from "@/lib/crm/stages/appointments-detail-contract";
import { AppointmentsDashboard } from "@/app/(protected)/app/etapas/_components/AppointmentsDashboard";
import { buildAppointmentComparison } from "@/app/(protected)/app/etapas/_components/appointments-comparison";
import { appointmentModel } from "./fixtures/appointments-summary";

const query: AppointmentDetailQuery = {
  view: "all",
  month: "2026-10",
  year: "2026",
  calendarDate: "2026-10-31",
  filters: {},
};

describe("lossless appointment summary and separate operational pages", () => {
  it("distinguishes an uncovered month from an empty valid selection and keeps the prior month readable", () => {
    const model = appointmentModel();
    const outside = { ...query, month: "2026-11", calendarDate: "2026-11-02" };
    expect(initialAppointmentDetailPage(model, outside)).toEqual({ status: "unavailable" });
    expect(() => appointmentDetailsCsv(model, outside)).toThrow("unavailable");
    expect(appointmentDetailPage(model, { ...outside, month: "2026-10" })).toMatchObject({
      status: "ready",
      total: 123,
    });
    const empty = { ...query, filters: { owner: "Sem registros" } };
    expect(appointmentDetailPage(model, empty)).toMatchObject({
      status: "ready",
      total: 0,
      rows: [],
    });
    expect(appointmentDetailsCsv(model, empty).total).toBe(0);
  });
  it("keeps snapshot identity stable across concurrent policy-map insertion order", () => {
    const model = appointmentModel();
    const reordered = {
      ...model,
      goalsByMonth: Object.fromEntries(Object.entries(model.goalsByMonth).reverse()),
      analysis: {
        ...model.analysis,
        dimensions: {
          stores: model.analysis.dimensions.stores,
          developments: model.analysis.dimensions.developments,
          owners: model.analysis.dimensions.owners,
          managers: model.analysis.dimensions.managers,
          companies: model.analysis.dimensions.companies,
        },
      },
    };
    expect(appointmentSnapshotIdentity(reordered)).toBe(appointmentSnapshotIdentity(model));
    reordered.goalsByMonth["2026-10"] = 25;
    expect(appointmentSnapshotIdentity(reordered)).not.toBe(appointmentSnapshotIdentity(model));
  });
  it("does not turn an unavailable operational source into an empty successful export", () => {
    const model = { ...appointmentModel(), analysis: null };
    expect(() => appointmentDetailPage(model, query)).toThrow("unavailable");
    expect(() => appointmentDetailsCsv(model, query)).toThrow("unavailable");
  });
  it.each<AppointmentFilters>([
    {},
    { channel: 1 },
    { channel: 0 },
    { manager: "Gerente A" },
    { owner: "Corretor B" },
    { regionalManager: "Regional A" },
    { company: "Empresa sintética" },
    { accountRanking: "Ouro" },
    { createdDates: ["2026-10-19"] },
    { periodStart: "2026-09-01", periodEnd: "2026-10-31" },
  ])(
    "preserves complete KPIs, history, roster, conversion and line comparison for %j",
    (filters) => {
      const model = appointmentModel();
      model.analysis!.appointments![0]!.createdAt = "2026-09-19T23:59:59-03:00";
      const compact = compactAppointmentSummary(model.analysis!)!;
      const expanded = expandAppointmentSummary(compact);
      const options = {
        month: query.month,
        year: query.year,
        filters,
        brokerRoster: model.brokerRoster,
        goalsByMonth: model.goalsByMonth,
        calendarDate: query.calendarDate,
      };
      const { details: originalDetails, ...original } = analyzeAppointments(
        model.analysis!,
        options,
      );
      const { details: summaryDetails, ...summary } = analyzeAppointments(expanded, options);
      expect(summary).toEqual(original);
      expect(summaryDetails?.length).toBe(originalDetails?.length);
      expect(buildAppointmentComparison(expanded, options)).toEqual(
        buildAppointmentComparison(model.analysis!, options),
      );
      expect(JSON.stringify(compact)).not.toContain("Conta sintética");
      expect(JSON.stringify(compact)).not.toContain("scheduledAt");
      expect(JSON.stringify(compact)).not.toContain("attendedAt");
    },
  );

  it("preserves v3 field presence and missing rankings, without inventing v4 scope", () => {
    const model = appointmentModel(6);
    const { brokerCount, brokerManagerCount, ...header } = model.analysis!;
    const v3 = {
      ...header,
      version: 3 as const,
      brokerCount,
      appointments: model.analysis!.appointments!.map((row) => ({
        createdAt: row.createdAt,
        scheduledAt: row.scheduledAt,
        attendedAt: row.attendedAt,
        regionalManager: row.regionalManager,
        salesManager: row.salesManager,
        owner: row.owner,
        visitPerformed: row.visitPerformed,
        accountName: "",
        accountRanking: "",
      })),
    };
    const compact = compactAppointmentSummary(v3)!;
    const decoded = expandAppointmentSummary(compact);
    expect(decoded.appointments?.every((row) => !("channel" in row))).toBe(true);
    const options = {
      month: query.month,
      year: query.year,
      filters: {},
      calendarDate: query.calendarDate,
    };
    const { details: beforeDetails, ...before } = analyzeAppointments(v3, options);
    const { details: afterDetails, ...after } = analyzeAppointments(decoded, options);
    expect(after).toEqual(before);
    expect(afterDetails?.length).toBe(beforeDetails?.length);
    expect(brokerManagerCount).toBe(2);
  });

  it("pages equal timestamps in stable snapshot order without duplicates or omissions", () => {
    const model = appointmentModel();
    const names: string[] = [];
    let cursor: string | null = null;
    do {
      const page = appointmentDetailPage(model, query, cursor);
      expect(page.rows!.length).toBeLessThanOrEqual(50);
      expect(page.total).toBe(123);
      names.push(...page.rows!.map((row) => row.accountName));
      cursor = page.nextCursor;
      if (page.offset === 50)
        expect(appointmentDetailPage(model, query, page.previousCursor).offset).toBe(0);
    } while (cursor);
    expect(names).toEqual(model.analysis!.appointments!.map((row) => row.accountName));
    expect(new Set(names).size).toBe(123);
    const page = appointmentDetailPage(model, query);
    expect(() =>
      appointmentDetailPage(model, { ...query, filters: { channel: 1 } }, page.nextCursor),
    ).toThrow();
    const changed = structuredClone(model);
    changed.analysis!.appointments![0]!.accountName = "Conta sintética alterada";
    expect(appointmentSnapshotIdentity(changed)).not.toBe(appointmentSnapshotIdentity(model));
    expect(() => appointmentDetailPage(changed, query, page.nextCursor)).toThrow();
  });

  it("exports the complete authorized selection and neutralizes spreadsheet formulas", () => {
    const model = appointmentModel();
    model.analysis!.appointments![122]!.accountName = '=HYPERLINK("https://example.invalid")';
    const exported = appointmentDetailsCsv(model, query);
    expect(exported.total).toBe(123);
    expect(exported.csv.split("\r\n")).toHaveLength(124);
    expect(exported.csv).toContain("' =".replace(" ", ""));
    expect(exported.csv).toContain("Conta sintética 00121");
    const house = appointmentDetailsCsv(model, { ...query, filters: { channel: 1 } });
    expect(house.total).toBe(61);
  });

  it("reduces the 20000-record initial payload and renders only real operational page fields", () => {
    const model = appointmentModel(20_000);
    const compact = compactAppointmentSummary(model.analysis!)!;
    const initialQuery = { ...query, filters: { channel: 1 as const } };
    const initialPage = appointmentDetailPage(model, initialQuery);
    const source = {
      view: query.view,
      snapshot: initialPage.snapshot,
      initialQueryKey: appointmentDetailQueryKey(initialQuery),
      initialPage,
    };
    const beforeBytes = Buffer.byteLength(JSON.stringify(model));
    const afterBytes = Buffer.byteLength(
      JSON.stringify({ ...model, analysis: undefined, compact, detailSource: source }),
    );
    expect(afterBytes).toBeLessThan(beforeBytes);
    if (process.env.APPOINTMENTS_DETAIL_EVIDENCE === "1") {
      mkdirSync("test-results/appointments-detail", { recursive: true });
      const sourceFiles = [
        "lib/crm/stages/appointments-summary.ts",
        "lib/crm/stages/appointments-detail-server.ts",
        "lib/crm/stages/appointments-detail-client.ts",
        "lib/crm/stages/appointments-detail-contract.ts",
        "app/(protected)/app/etapas/_components/AppointmentsDashboard.tsx",
        "app/(protected)/app/etapas/_components/appointments-actions.ts",
      ];
      writeFileSync(
        "test-results/appointments-detail/payload.json",
        JSON.stringify(
          {
            method:
              "Canonical server helper and compact codec; synthetic JSON DTO serialization with actual cursor; not Next transfer bytes, page latency or user percentiles.",
            fixture: "20000 appointments, equal timestamps and two broker labels",
            records: 20000,
            beforeBytes,
            afterBytes,
            pageRows: initialPage.rows!.length,
            rawOperationsSent: 0,
            cursorBytes: Buffer.byteLength(initialPage.nextCursor!),
            snapshot: initialPage.snapshot,
            head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
            workingTree: true,
            node: process.version,
            sourceHashes: Object.fromEntries(
              sourceFiles.map((file) => [
                file,
                createHash("sha256").update(readFileSync(file)).digest("hex"),
              ]),
            ),
          },
          null,
          2,
        ),
      );
    }
    const html = renderToStaticMarkup(
      <AppointmentsDashboard
        analysis={null}
        compactSummary={compact}
        detailSource={source}
        calendarDate={query.calendarDate}
        brokerRoster={model.brokerRoster}
        goalsByMonth={model.goalsByMonth}
      />,
    );
    expect(html).toContain("Conta sintética 00001");
    expect(html).not.toContain("Conta sintética 00101");
    expect(html).toContain("Exibindo 1–50 de 10000");
    expect(html).toContain("Exportar CSV completo");
  });
});
