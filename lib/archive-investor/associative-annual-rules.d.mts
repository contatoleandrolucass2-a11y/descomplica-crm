export function floorMoney(value: number | string | null | undefined): number;
export function getAssociativeAnnualLimit(income: number | string | null | undefined): number;
export type AssociativeAnnualEligibility = {
  index: number;
  date: string;
  eligible: boolean;
  reason: string;
};
export function getAssociativeAnnualEligibility(input: {
  baseDate: string;
  completionDate: string;
  entryDate?: string | undefined;
  signalDates?: readonly string[] | undefined;
}): AssociativeAnnualEligibility[];
