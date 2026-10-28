"use client";

import { ExternalLink, MessageCircle, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardCanvas } from "@/lib/dashboard-canvas/ui/dashboard-canvas";
import { DashboardModal } from "@/lib/dashboard-canvas/ui/configurable/modal";
import type { DashboardCard } from "@/lib/dashboard-canvas/types";
import type { UsefulLinksPage } from "@/lib/crm/useful-links/content";
import {
  createDefaultUsefulLinksDocument,
  usefulLinksDocumentSchema,
  type UsefulLinksCard,
  type UsefulLinksDocument,
  type UsefulLinksOrgChartCard,
  type UsefulLinksSectionCard,
} from "@/lib/crm/useful-links/document";

import styles from "./UsefulLinksBoard.module.css";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "failure" | "conflict";

function canvasCard(card: UsefulLinksCard): DashboardCard {
  return {
    id: card.id,
    type: "table",
    metric: `useful-links.${card.id}`,
    title: card.title,
    period: "global",
    groupBy: "entity",
    entityIds: null,
    layout: card.layout,
  };
}

function cardId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusLabel(state: SaveState) {
  if (state === "saving") return "Salvando…";
  if (state === "saved") return "Alterações salvas";
  if (state === "dirty") return "Alterações não salvas";
  if (state === "conflict") return "Conflito de edição";
  if (state === "failure") return "Falha ao salvar";
  return "Conteúdo compartilhado";
}

function parseParagraphs(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function tableText(table: UsefulLinksSectionCard["table"]) {
  if (!table) return "";
  return [table.headers, ...table.rows].map((row) => row.join("\t")).join("\n");
}

function parseTable(value: string): UsefulLinksSectionCard["table"] {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\t").map((cell) => cell.trim()));
  if (!lines.length) return null;
  const [headers, ...rows] = lines;
  if (!headers?.length) return null;
  return { headers, rows };
}

function SectionContent({ card, showTitle }: { card: UsefulLinksSectionCard; showTitle: boolean }) {
  return (
    <div className={styles.cardContent}>
      {showTitle ? <h2>{card.title}</h2> : null}
      {card.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {card.items.length ? (
        <ul className={styles.itemList}>
          {card.items.map((item) => (
            <li key={item.id}>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  <span>{item.label}</span>
                  <ExternalLink size={16} aria-hidden="true" />
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              ) : (
                <strong>{item.label}</strong>
              )}
              {item.description ? <p>{item.description}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {card.table ? (
        <div className={styles.tableScroll} role="region" aria-label={card.title} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {card.table.headers.map((header) => (
                  <th scope="col" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {card.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) =>
                    cellIndex === 0 ? (
                      <th scope="row" key={cellIndex}>
                        {cell}
                      </th>
                    ) : (
                      <td key={cellIndex}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function orgLevels(nodes: UsefulLinksOrgChartCard["nodes"]) {
  const levels: UsefulLinksOrgChartCard["nodes"][] = [];
  let current = nodes.filter(({ parentId }) => parentId === null).sort((a, b) => a.order - b.order);
  const visited = new Set<string>();
  while (current.length && levels.length < nodes.length) {
    levels.push(current);
    current.forEach(({ id }) => visited.add(id));
    const parentIds = new Set(current.map(({ id }) => id));
    current = nodes
      .filter(({ id, parentId }) => parentId && parentIds.has(parentId) && !visited.has(id))
      .sort((a, b) => a.order - b.order);
  }
  return levels;
}

function OrgChart({ card, showTitle }: { card: UsefulLinksOrgChartCard; showTitle: boolean }) {
  return (
    <div className={styles.cardContent}>
      {showTitle ? <h2>{card.title}</h2> : null}
      {card.note ? <p className={styles.orgNote}>{card.note}</p> : null}
      <div className={styles.orgChart}>
        {orgLevels(card.nodes).map((level, levelIndex) => (
          <div className={styles.orgLevel} key={levelIndex}>
            {level.map((node) => (
              <article className={styles.orgNode} key={node.id}>
                <strong>{node.role}</strong>
                {node.href ? (
                  <a href={node.href} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={24} aria-hidden="true" />
                    <span>{node.name || "Abrir WhatsApp"}</span>
                    {node.phone ? <small>{node.phone}</small> : null}
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                ) : (
                  <span>
                    {node.name || "Nome a definir"}
                    {node.phone ? <small>{node.phone}</small> : null}
                  </span>
                )}
              </article>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardEditor({
  card,
  onChange,
}: {
  card: UsefulLinksCard;
  onChange: (card: UsefulLinksCard) => void;
}) {
  if (card.kind === "org-chart") {
    return (
      <div className={styles.editorFields}>
        <label>
          Título
          <input
            value={card.title}
            onChange={(event) => onChange({ ...card, title: event.target.value })}
          />
        </label>
        <label>
          Observação
          <textarea
            value={card.note}
            onChange={(event) => onChange({ ...card, note: event.target.value })}
          />
        </label>
        <div className={styles.editorHeading}>
          <h3>Integrantes</h3>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...card,
                nodes: [
                  ...card.nodes,
                  {
                    id: cardId("integrante"),
                    parentId: card.nodes.at(-1)?.id ?? null,
                    role: "Novo cargo",
                    name: "",
                    phone: "",
                    href: null,
                    order: card.nodes.length,
                  },
                ],
              })
            }
          >
            <Plus size={16} aria-hidden="true" /> Integrante
          </button>
        </div>
        {card.nodes.map((node) => (
          <fieldset className={styles.editorRow} key={node.id}>
            <legend>{node.role}</legend>
            <label>
              Cargo
              <input
                value={node.role}
                onChange={(event) =>
                  onChange({
                    ...card,
                    nodes: card.nodes.map((entry) =>
                      entry.id === node.id ? { ...entry, role: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
            <label>
              Nome
              <input
                value={node.name}
                onChange={(event) =>
                  onChange({
                    ...card,
                    nodes: card.nodes.map((entry) =>
                      entry.id === node.id ? { ...entry, name: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
            <label>
              Telefone
              <input
                value={node.phone}
                onChange={(event) =>
                  onChange({
                    ...card,
                    nodes: card.nodes.map((entry) =>
                      entry.id === node.id ? { ...entry, phone: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
            <label>
              Link WhatsApp
              <input
                value={node.href ?? ""}
                onChange={(event) =>
                  onChange({
                    ...card,
                    nodes: card.nodes.map((entry) =>
                      entry.id === node.id ? { ...entry, href: event.target.value || null } : entry,
                    ),
                  })
                }
              />
            </label>
            <label>
              Liderança
              <select
                value={node.parentId ?? ""}
                onChange={(event) =>
                  onChange({
                    ...card,
                    nodes: card.nodes.map((entry) =>
                      entry.id === node.id
                        ? { ...entry, parentId: event.target.value || null }
                        : entry,
                    ),
                  })
                }
              >
                <option value="">Topo do organograma</option>
                {card.nodes
                  .filter(({ id }) => id !== node.id)
                  .map((candidate) => (
                    <option value={candidate.id} key={candidate.id}>
                      {candidate.role} — {candidate.name || "sem nome"}
                    </option>
                  ))}
              </select>
            </label>
            {card.nodes.length > 1 ? (
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() =>
                  onChange({
                    ...card,
                    nodes: card.nodes
                      .filter(({ id }) => id !== node.id)
                      .map((entry) =>
                        entry.parentId === node.id ? { ...entry, parentId: null } : entry,
                      ),
                  })
                }
              >
                <Trash2 size={16} aria-hidden="true" /> Remover
              </button>
            ) : null}
          </fieldset>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.editorFields}>
      <label>
        Título
        <input
          value={card.title}
          onChange={(event) => onChange({ ...card, title: event.target.value })}
        />
      </label>
      <label>
        Textos separados por uma linha em branco
        <textarea
          rows={7}
          value={card.paragraphs.join("\n\n")}
          onChange={(event) =>
            onChange({ ...card, paragraphs: parseParagraphs(event.target.value) })
          }
        />
      </label>
      <div className={styles.editorHeading}>
        <h3>Links e informações</h3>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...card,
              items: [
                ...card.items,
                { id: cardId("item"), label: "Novo item", href: null, description: "" },
              ],
            })
          }
        >
          <Plus size={16} aria-hidden="true" /> Item
        </button>
      </div>
      {card.items.map((item) => (
        <fieldset className={styles.editorRow} key={item.id}>
          <legend>{item.label}</legend>
          <label>
            Nome
            <input
              value={item.label}
              onChange={(event) =>
                onChange({
                  ...card,
                  items: card.items.map((entry) =>
                    entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                  ),
                })
              }
            />
          </label>
          <label>
            Destino
            <input
              value={item.href ?? ""}
              onChange={(event) =>
                onChange({
                  ...card,
                  items: card.items.map((entry) =>
                    entry.id === item.id ? { ...entry, href: event.target.value || null } : entry,
                  ),
                })
              }
            />
          </label>
          <label>
            Descrição
            <textarea
              value={item.description}
              onChange={(event) =>
                onChange({
                  ...card,
                  items: card.items.map((entry) =>
                    entry.id === item.id ? { ...entry, description: event.target.value } : entry,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() =>
              onChange({ ...card, items: card.items.filter(({ id }) => id !== item.id) })
            }
          >
            <Trash2 size={16} aria-hidden="true" /> Remover
          </button>
        </fieldset>
      ))}
      <label>
        Tabela (colunas separadas por tabulação)
        <textarea
          rows={8}
          value={tableText(card.table)}
          onChange={(event) => onChange({ ...card, table: parseTable(event.target.value) })}
        />
      </label>
    </div>
  );
}

export function UsefulLinksBoard({ page }: { page: UsefulLinksPage }) {
  const fallback = useMemo(() => createDefaultUsefulLinksDocument(page), [page]);
  const [document, setDocument] = useState<UsefulLinksDocument>(fallback);
  const [canEdit, setCanEdit] = useState(false);
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<UsefulLinksCard | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`/api/useful-links/${page.slug}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: signal ?? null,
        });
        const payload = (await response.json()) as {
          document?: unknown;
          canEdit?: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "load_failed");
        setCanEdit(payload.canEdit === true);
        if (payload.document) {
          const parsed = usefulLinksDocumentSchema.safeParse(payload.document);
          if (parsed.success) setDocument(parsed.data);
        }
        setState("idle");
        setMessage("");
      } catch {
        if (signal?.aborted) return;
        setState("failure");
        setMessage(
          "O conteúdo versionado continua visível, mas não foi possível consultar a edição compartilhada.",
        );
      }
    },
    [page.slug],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  function updateDocument(cards: UsefulLinksCard[]) {
    setDocument((current) => ({ ...current, cards }));
    setState("dirty");
    setMessage("");
  }

  async function save() {
    const parsed = usefulLinksDocumentSchema.safeParse(document);
    if (!parsed.success) {
      setState("failure");
      setMessage(parsed.error.issues[0]?.message ?? "Revise os campos antes de salvar.");
      return;
    }
    setState("saving");
    try {
      const response = await fetch(`/api/useful-links/${page.slug}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as { document?: unknown; error?: string };
      if (response.status === 409) {
        setState("conflict");
        setMessage("Outra pessoa salvou esta página. Recarregue antes de tentar novamente.");
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "save_failed");
      const saved = usefulLinksDocumentSchema.safeParse(payload.document);
      if (!saved.success) throw new Error("invalid_response");
      setDocument(saved.data);
      setState("saved");
      setMessage("");
    } catch {
      setState("failure");
      setMessage("Não foi possível salvar. O rascunho permanece nesta tela.");
    }
  }

  const dashboardCards = document.cards.map(canvasCard);
  return (
    <div className={styles.board}>
      {canEdit ? (
        <div className={styles.toolbar} aria-label="Edição da página">
          <button
            type="button"
            onClick={() =>
              updateDocument([
                ...document.cards,
                {
                  id: cardId("card"),
                  kind: "section",
                  title: "Novo card",
                  paragraphs: ["Edite este conteúdo."],
                  items: [],
                  table: null,
                  layout: { order: document.cards.length, columnSpan: 6, height: 320 },
                },
              ])
            }
          >
            <Plus size={17} aria-hidden="true" /> Adicionar card
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void save()}
            disabled={state !== "dirty" && state !== "failure"}
          >
            <Save size={17} aria-hidden="true" /> Salvar alterações
          </button>
          {state === "conflict" ? (
            <button type="button" onClick={() => void load()}>
              <RefreshCw size={17} aria-hidden="true" /> Recarregar
            </button>
          ) : null}
          <span className={styles.saveStatus} data-state={state}>
            {statusLabel(state)}
          </span>
        </div>
      ) : null}
      {message ? (
        <p className={styles.notice} role="status" data-state={state}>
          {message}
        </p>
      ) : null}
      <DashboardCanvas
        cards={dashboardCards}
        disabled={!canEdit}
        ariaLabel={`Cards de ${page.title}`}
        onCommit={(next) =>
          updateDocument(
            next.map((canvas) => ({
              ...document.cards.find(({ id }) => id === canvas.id)!,
              title: canvas.title ?? document.cards.find(({ id }) => id === canvas.id)!.title,
              layout: canvas.layout,
            })),
          )
        }
        renderCard={(canvas) => {
          const card = document.cards.find(({ id }) => id === canvas.id)!;
          return (
            <div className={styles.renderedCard}>
              {canEdit ? (
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setEditor(structuredClone(card))}
                >
                  <Pencil size={16} aria-hidden="true" /> Editar
                </button>
              ) : null}
              {card.kind === "org-chart" ? (
                <OrgChart card={card} showTitle={!canEdit} />
              ) : (
                <SectionContent card={card} showTitle={!canEdit} />
              )}
            </div>
          );
        }}
      />
      {editor ? (
        <DashboardModal
          title={`Editar ${editor.title}`}
          description="As mudanças entram no rascunho. Use Salvar alterações para publicar o conteúdo compartilhado."
          onClose={() => setEditor(null)}
          wide
          footer={
            <>
              <button type="button" onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => {
                  updateDocument(
                    document.cards
                      .filter(({ id }) => id !== editor.id)
                      .map((card, order) => ({ ...card, layout: { ...card.layout, order } })),
                  );
                  setEditor(null);
                }}
              >
                <Trash2 size={16} aria-hidden="true" /> Excluir card
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  const parsed = usefulLinksDocumentSchema.safeParse({
                    ...document,
                    cards: document.cards.map((card) => (card.id === editor.id ? editor : card)),
                  });
                  if (!parsed.success) {
                    setMessage(parsed.error.issues[0]?.message ?? "Revise o card.");
                    setState("failure");
                    return;
                  }
                  updateDocument(parsed.data.cards);
                  setEditor(null);
                }}
              >
                <Save size={16} aria-hidden="true" /> Aplicar ao rascunho
              </button>
            </>
          }
        >
          <CardEditor card={editor} onChange={setEditor} />
        </DashboardModal>
      ) : null}
    </div>
  );
}
