export type RecoveryActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"password" | "confirmPassword", string[]>>;
};

export const initialRecoveryActionState: RecoveryActionState = { status: "idle" };
