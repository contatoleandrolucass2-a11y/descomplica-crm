export type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export type MfaActionState = {
  status: "idle" | "error";
  message?: string;
  enrollment?: TotpEnrollment;
};

export const initialMfaActionState: MfaActionState = { status: "idle" };
