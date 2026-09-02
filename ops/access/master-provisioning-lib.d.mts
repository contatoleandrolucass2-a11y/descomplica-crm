export type MasterProvisioningEnvironment = "homologation" | "production";

export type MasterProvisioningRequest = Readonly<{
  changeRef: string;
  environment: MasterProvisioningEnvironment;
  targetEmailSha256: string;
  termsVersion: string;
  privacyVersion: string;
  status: "authorized";
}>;

export type MasterProvisioningManifest = Readonly<{
  schemaVersion: 1;
  requests: readonly MasterProvisioningRequest[];
}>;

export type MasterProvisioningArguments = Readonly<{
  mode: "preflight" | "apply";
  changeRef: string;
  databaseUrlFile: string;
  environment: MasterProvisioningEnvironment;
  expectedSha: string;
  confirmation: string | null;
}>;

export function validateMasterProvisioningManifest(
  rawManifest: unknown,
): MasterProvisioningManifest;
export function selectMasterProvisioningRequest(
  manifest: MasterProvisioningManifest,
  changeRef: string,
  environment: string,
): MasterProvisioningRequest;
export function parseMasterProvisioningArguments(arguments_: string[]): MasterProvisioningArguments;
