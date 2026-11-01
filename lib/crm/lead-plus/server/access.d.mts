export const canonicalLeadPages: Record<string, string>;
export function operationPage(path: string, method: string): string | null;
export function intersectPermissions(permissions: string[], pages: string[]): string[];
export function operationPermissions(path: string, method: string): string[] | null;
export function intersectGranularPermissions(permissions: string[], canonical: string[]): string[];
