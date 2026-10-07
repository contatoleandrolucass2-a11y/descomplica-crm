export interface RepasseRecord {
  empreendimento: string | null;
  etapa: string | null;
  status: string | null;
  nomeCliente: string | null;
  motivo: string | null;
}

export type RepasseBoardColumn = "repassado" | "pendencia" | "mais_de_20_dias" | "distrato";

export interface RepasseBoardRecord extends Omit<RepasseRecord, "motivo"> {
  sourceRow: number;
  fid: string | null;
  column: RepasseBoardColumn;
}

export interface RepasseOverview {
  lastUpdated: string | null;
  records: RepasseBoardRecord[];
}

export type RepasseOverviewState =
  | { status: "ready"; overview: RepasseOverview }
  | { status: "unavailable"; message: string };

export type RepasseLookupState =
  | { status: "idle" }
  | { status: "validation_error"; message: string }
  | { status: "not_found"; fid: string; lastUpdated: string | null; message: string }
  | { status: "source_conflict"; fid: string; message: string }
  | {
      status: "ready";
      fid: string;
      lastUpdated: string | null;
      record: RepasseRecord;
    }
  | { status: "unavailable"; message: string };
