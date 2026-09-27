export function transformProductionImageEnvironment(
  contents: string,
  expectedOldSha: string,
  newSha: string,
): string;

export function parseProductionImageBindingArguments(arguments_: readonly string[]): Readonly<{
  operation: "bind" | "rollback";
  expectedCurrentSha: string;
  targetSha: string;
  boundarySha: string;
  expectedImageId: string;
}>;
