import { constrainCardLayout, CANVAS_COLUMN_COUNT, type DashboardCardLayoutPolicy } from "./limits";
import type { DashboardCard } from "../types";

export interface PackedDashboardCard {
  card: DashboardCard;
  row: number;
  column: number;
  columnSpan: number;
  rowHeight: number;
  isActive: boolean;
}

export function packCanvas(
  cards: readonly DashboardCard[],
  activeCardId?: string,
  layoutPolicy?: DashboardCardLayoutPolicy,
) {
  const ordered = cards
    .map((card, sourceIndex) => ({ card, sourceIndex }))
    .sort(
      (left, right) =>
        left.card.layout.order - right.card.layout.order || left.sourceIndex - right.sourceIndex,
    );
  const rows: Array<Array<{ card: DashboardCard; span: number }>> = [];
  let currentRow: Array<{ card: DashboardCard; span: number }> = [];
  let usedColumns = 0;

  for (const { card } of ordered) {
    const layout = constrainCardLayout(card.type, card.layout, layoutPolicy);
    const normalizedCard = { ...card, layout };
    if (currentRow.length > 0 && usedColumns + layout.columnSpan > CANVAS_COLUMN_COUNT) {
      rows.push(currentRow);
      currentRow = [];
      usedColumns = 0;
    }
    currentRow.push({ card: normalizedCard, span: layout.columnSpan });
    usedColumns += layout.columnSpan;
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return rows.flatMap((rowCards, rowIndex) => {
    const rowHeight = Math.max(...rowCards.map(({ card }) => card.layout.height));
    let column = 1;
    return rowCards.map(({ card, span }) => {
      const packed: PackedDashboardCard = {
        card,
        row: rowIndex + 1,
        column,
        columnSpan: span,
        rowHeight,
        isActive: card.id === activeCardId,
      };
      column += span;
      return packed;
    });
  });
}

export function hasCanvasOverlap(cards: readonly PackedDashboardCard[]) {
  for (let index = 0; index < cards.length; index += 1) {
    const current = cards[index]!;
    for (let comparison = index + 1; comparison < cards.length; comparison += 1) {
      const candidate = cards[comparison]!;
      if (current.row !== candidate.row) continue;
      const currentEnd = current.column + current.columnSpan;
      const candidateEnd = candidate.column + candidate.columnSpan;
      if (current.column < candidateEnd && candidate.column < currentEnd) return true;
    }
  }
  return false;
}
