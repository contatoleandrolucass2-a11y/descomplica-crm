export const runtimeStateLockPath: string;

export function enterRuntimeStateLock(
  options: Readonly<{
    arguments_: readonly string[];
    environment?: Readonly<Record<string, string>>;
    scriptPath: string;
  }>,
): Promise<
  Readonly<{
    arguments_: string[];
    delegated: boolean;
  }>
>;
