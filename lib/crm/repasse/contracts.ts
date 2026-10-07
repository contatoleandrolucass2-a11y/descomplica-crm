export interface RepasseRecord {
  empreendimento: string | null;
  etapa: string | null;
  status: string | null;
  nomeCliente: string | null;
  motivo: string | null;
}

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
