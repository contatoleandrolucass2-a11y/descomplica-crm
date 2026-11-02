import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";

/** Lossless inputs for the analytical engine; operational display fields stay server-side. */
export interface AppointmentSummaryTransport {
  header: Omit<DashboardAnalysisSlice, "appointments">;
  labels: string[];
  rows: Array<[string, number, number, number, number, 0 | 1, number?, number?, (0 | 1)?]>;
}

export function compactAppointmentSummary(
  analysis: DashboardAnalysisSlice,
): AppointmentSummaryTransport | null {
  if (analysis.version < 3 || !analysis.appointments) return null;
  const { appointments, ...header } = analysis;
  const labels: string[] = [];
  const indices = new Map<string, number>();
  const index = (value: string) => {
    let found = indices.get(value);
    if (found === undefined) {
      found = labels.length;
      indices.set(value, found);
      labels.push(value);
    }
    return found;
  };
  const rows: AppointmentSummaryTransport["rows"] = appointments.map((row) => {
    const common: [string, number, number, number, number, 0 | 1] = [
      row.createdAt,
      index(row.regionalManager),
      index(row.salesManager),
      index(row.owner),
      index(row.accountRanking),
      row.visitPerformed ? 1 : 0,
    ];
    return "channel" in row
      ? [...common, row.channel, index(row.company), row.registeredBroker ? 1 : 0]
      : common;
  });
  return { header, labels, rows };
}

/** Placeholder display fields are deliberately unavailable to the detail renderer. */
export function expandAppointmentSummary(
  compact: AppointmentSummaryTransport,
): DashboardAnalysisSlice {
  const label = (index: number) => compact.labels[index]!;
  return {
    ...compact.header,
    appointments: compact.rows.map((row) => ({
      createdAt: row[0],
      regionalManager: label(row[1]),
      salesManager: label(row[2]),
      owner: label(row[3]),
      accountRanking: label(row[4]),
      visitPerformed: row[5] === 1,
      accountName: "",
      scheduledAt: null,
      attendedAt: null,
      ...(row.length === 9
        ? { channel: row[6]!, company: label(row[7]!), registeredBroker: row[8] === 1 }
        : {}),
    })),
  };
}
