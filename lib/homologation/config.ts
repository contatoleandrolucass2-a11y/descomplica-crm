type HomologationEnvironment = {
  HOMOLOGATION_MODE?: string;
  PUBLIC_SIGNUP_ENABLED?: string;
};

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isHomologationMode(environment?: HomologationEnvironment): boolean {
  return enabled(environment?.HOMOLOGATION_MODE ?? process.env.HOMOLOGATION_MODE);
}

export function isPublicSignupEnabled(environment?: HomologationEnvironment): boolean {
  return (
    (environment?.PUBLIC_SIGNUP_ENABLED ?? process.env.PUBLIC_SIGNUP_ENABLED)
      ?.trim()
      .toLowerCase() !== "false"
  );
}
