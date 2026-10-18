import type { RegisteredPage } from "../../lib/navigation/registry";
export function renderPageCatalogMigration(registry?: readonly RegisteredPage[]): string;
export function validatePageRegistry(registry?: readonly RegisteredPage[]): void;
export function checkPageRoutes(
  repositoryRoot?: string,
  registry?: readonly RegisteredPage[],
): Promise<void>;
export function checkPageCatalog(
  repositoryRoot?: string,
): Promise<{ directory: string; latest: string | undefined; sql: string; synchronized: boolean }>;
