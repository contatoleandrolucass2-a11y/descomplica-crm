export interface SalesforceSourceReports {
  brokers?: Array<Record<string, unknown>>;
  imobAccounts?: Array<Record<string, unknown>>;
  opportunities?: Array<Record<string, unknown>>;
  appointments?: Array<Record<string, unknown>>;
  visits?: Array<Record<string, unknown>>;
  folders?: Array<Record<string, unknown>>;
  sales?: Array<Record<string, unknown>>;
}

export interface SalesforceTransformInput {
  reports: SalesforceSourceReports;
  referenceDate: string;
  generatedAt: string;
  requestId: string;
  goals?: Record<string, Record<string, { month: number; week: number; today: number }>>;
}

export function buildSalesforceSnapshot(input: SalesforceTransformInput): {
  payload: unknown;
  diagnostics: Record<string, unknown>;
};
