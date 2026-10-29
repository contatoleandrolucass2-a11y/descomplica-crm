import { findDuplicateCard } from "../signature";
import type {
  DashboardCanvasSnapshot,
  DashboardCard,
  DashboardCardPatch,
  DashboardCardLayout,
} from "../types";
import {
  CURRENT_DASHBOARD_SCHEMA_VERSION,
  migrateCanvasSchema,
  normalizeDashboardCard,
  normalizeDashboardCards,
  serializeCanvasSnapshot,
} from "./migrations";
import type { DashboardCardLayoutPolicy } from "../layout/limits";

export const DEFAULT_CANVAS_HISTORY_LIMIT = 40;

export interface CanvasHistoryState {
  present: DashboardCanvasSnapshot;
  history: DashboardCanvasSnapshot[];
  future: DashboardCanvasSnapshot[];
  historyLimit: number;
  duplicateCardId: string | null;
  layoutPolicy?: DashboardCardLayoutPolicy | undefined;
}

export type CanvasAction =
  | { type: "add-card"; card: DashboardCard }
  | { type: "remove-card"; cardId: string }
  | { type: "update-card"; cardId: string; patch: DashboardCardPatch }
  | { type: "move-card"; cardId: string; toIndex: number }
  | {
      type: "resize-card";
      cardId: string;
      layout: Pick<DashboardCardLayout, "columnSpan" | "height" | "width">;
    }
  | { type: "organize" }
  | { type: "reset"; cards: readonly DashboardCard[] }
  | { type: "replace"; cards: readonly DashboardCard[]; recordHistory?: boolean }
  | { type: "clear-duplicate" }
  | { type: "undo" }
  | { type: "redo" };

function snapshot(
  cards: readonly DashboardCard[],
  layoutPolicy?: DashboardCardLayoutPolicy,
): DashboardCanvasSnapshot {
  return {
    schemaVersion: CURRENT_DASHBOARD_SCHEMA_VERSION,
    cards: normalizeDashboardCards(cards, layoutPolicy),
  };
}

function sameSnapshot(
  left: DashboardCanvasSnapshot,
  right: DashboardCanvasSnapshot,
  layoutPolicy?: DashboardCardLayoutPolicy,
) {
  return (
    serializeCanvasSnapshot(left, layoutPolicy) === serializeCanvasSnapshot(right, layoutPolicy)
  );
}

function commit(state: CanvasHistoryState, next: DashboardCanvasSnapshot): CanvasHistoryState {
  if (sameSnapshot(state.present, next, state.layoutPolicy)) {
    return state.duplicateCardId === null ? state : { ...state, duplicateCardId: null };
  }
  return {
    ...state,
    present: next,
    history: [...state.history, state.present].slice(-state.historyLimit),
    future: [],
    duplicateCardId: null,
  };
}

function reorder(cards: readonly DashboardCard[], cardId: string, toIndex: number) {
  const fromIndex = cards.findIndex((card) => card.id === cardId);
  if (fromIndex < 0 || cards.length === 0) return cards;
  const target = Math.min(Math.max(Math.round(toIndex), 0), cards.length - 1);
  if (target === fromIndex) return cards;
  const next = [...cards];
  const [card] = next.splice(fromIndex, 1);
  if (!card) return cards;
  next.splice(target, 0, card);
  return next.map((entry, order) => ({
    ...entry,
    layout: { ...entry.layout, order },
  }));
}

export function createCanvasHistoryState(
  cards: readonly DashboardCard[] = [],
  historyLimit = DEFAULT_CANVAS_HISTORY_LIMIT,
  layoutPolicy?: DashboardCardLayoutPolicy,
): CanvasHistoryState {
  if (!Number.isSafeInteger(historyLimit) || historyLimit < 1) {
    throw new RangeError("Canvas history limit must be a positive safe integer.");
  }
  return {
    present: snapshot(cards, layoutPolicy),
    history: [],
    future: [],
    historyLimit,
    duplicateCardId: null,
    layoutPolicy,
  };
}

export function canvasReducer(state: CanvasHistoryState, action: CanvasAction): CanvasHistoryState {
  if (action.type === "undo") {
    const previous = state.history.at(-1);
    if (!previous) return state;
    return {
      ...state,
      present: migrateCanvasSchema(previous, state.layoutPolicy),
      history: state.history.slice(0, -1),
      future: [state.present, ...state.future].slice(0, state.historyLimit),
      duplicateCardId: null,
    };
  }
  if (action.type === "redo") {
    const next = state.future[0];
    if (!next) return state;
    return {
      ...state,
      present: migrateCanvasSchema(next, state.layoutPolicy),
      history: [...state.history, state.present].slice(-state.historyLimit),
      future: state.future.slice(1),
      duplicateCardId: null,
    };
  }
  if (action.type === "clear-duplicate") {
    return state.duplicateCardId === null ? state : { ...state, duplicateCardId: null };
  }
  if (action.type === "add-card") {
    const card = normalizeDashboardCard(
      action.card,
      state.present.cards.length,
      state.layoutPolicy,
    );
    if (!card) return state;
    const duplicate = findDuplicateCard(state.present.cards, card);
    if (duplicate) return { ...state, duplicateCardId: duplicate.id };
    return commit(state, snapshot([...state.present.cards, card], state.layoutPolicy));
  }
  if (action.type === "remove-card") {
    return commit(
      state,
      snapshot(
        state.present.cards.filter((card) => card.id !== action.cardId),
        state.layoutPolicy,
      ),
    );
  }
  if (action.type === "move-card") {
    return commit(
      state,
      snapshot(reorder(state.present.cards, action.cardId, action.toIndex), state.layoutPolicy),
    );
  }
  if (action.type === "resize-card") {
    return commit(
      state,
      snapshot(
        state.present.cards.map((card) =>
          card.id === action.cardId
            ? { ...card, layout: { ...card.layout, ...action.layout } }
            : card,
        ),
        state.layoutPolicy,
      ),
    );
  }
  if (action.type === "update-card") {
    const current = state.present.cards.find((card) => card.id === action.cardId);
    if (!current) return state;
    const candidate = normalizeDashboardCard(
      {
        ...current,
        ...action.patch,
        layout: { ...current.layout, ...action.patch.layout },
        options: action.patch.options ?? current.options,
      },
      current.layout.order,
      state.layoutPolicy,
    );
    if (!candidate) return state;
    const duplicate = findDuplicateCard(state.present.cards, candidate, current.id);
    if (duplicate) return { ...state, duplicateCardId: duplicate.id };
    return commit(
      state,
      snapshot(
        state.present.cards.map((card) => (card.id === candidate.id ? candidate : card)),
        state.layoutPolicy,
      ),
    );
  }
  if (action.type === "organize")
    return commit(state, snapshot(state.present.cards, state.layoutPolicy));
  if (action.type === "reset") return commit(state, snapshot(action.cards, state.layoutPolicy));
  if (action.recordHistory === false) {
    return {
      ...state,
      present: snapshot(action.cards, state.layoutPolicy),
      history: [],
      future: [],
      duplicateCardId: null,
    };
  }
  return commit(state, snapshot(action.cards, state.layoutPolicy));
}
