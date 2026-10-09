export interface LocalSupabasePorts {
  shadow: number;
  api: number;
  database: number;
  studio: number;
  mail: number;
  analytics: number;
  pooler: number;
  inspector: number;
}

export function patchLocalSupabaseConfig(
  contents: string,
  projectId: string,
  ports: LocalSupabasePorts,
): string;
