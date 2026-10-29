"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Expand,
  LayoutGrid,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";

import { DashboardCanvas } from "../dashboard-canvas";
import {
  DASHBOARD_CARD_LAYOUT_LIMITS,
  constrainCardLayout,
  FREE_CARD_MIN_WIDTH,
  FREE_CARD_MIN_HEIGHT,
  FREE_CARD_MAX_SIZE,
  type DashboardCardLayoutPolicy,
} from "../../layout/limits";
import { canvasReducer, createCanvasHistoryState } from "../../state/reducer";
import { DASHBOARD_CANVAS_SCHEMA_VERSION, serializeCanvasSnapshot } from "../../state/migrations";
import type {
  DashboardCard,
  DashboardCardOptions,
  DashboardCardPresentation,
  DashboardCardSize,
  DashboardCardType,
  DashboardGroupBy,
  DashboardPeriod,
} from "../../types";
import { DashboardModal } from "./modal";
import {
  DEFAULT_CARD_TYPE_LABELS,
  DEFAULT_GROUP_LABELS,
  DEFAULT_OPTION_LABELS,
  DEFAULT_PERIOD_LABELS,
  compatibleGroups,
  compatibleOptions,
  compatiblePeriods,
  compatibleTypes,
  createCatalogCard,
  moveSelectedCards,
  reconcileCardCompatibility,
} from "./model";
import { downloadDashboardPdf } from "./pdf";
import type {
  ConfigurableDashboardCanvasProps,
  ConfigurableDashboardCatalog,
  ConfigurableDashboardCompatibility,
  DashboardCardOptionKey,
} from "./types";
import styles from "./configurable-dashboard-canvas.module.css";

type SaveState = "idle" | "saving" | "saved" | "failure" | "conflict";

export interface RemoteDashboardProfile {
  id: string;
  userId: string;
  pageKey: string;
  scopeKey: string | null;
  name: string;
  isDefault: boolean;
  version: number;
  schemaVersion: 2;
  cards: DashboardCard[];
  createdAt: string;
  updatedAt: string;
}

export function reconcileDefaultProfileChange(
  profiles: readonly RemoteDashboardProfile[],
  updated: RemoteDashboardProfile,
) {
  return profiles.map((entry) => {
    if (entry.id === updated.id) return updated;
    if (!entry.isDefault) return entry;
    return {
      ...entry,
      isDefault: false,
      version: entry.version + 1,
      updatedAt: updated.updatedAt,
    };
  });
}

class ProfileRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function profileRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const requestInit: RequestInit = { ...init, credentials: "same-origin" };
  if (init?.body) {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    requestInit.headers = headers;
  }
  const response = await fetch(url, requestInit);
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok)
    throw new ProfileRequestError(response.status, payload.error ?? "profile_request_failed");
  return payload;
}

function profileCacheKey(pageKey: string, scopeKey?: string) {
  return `dashboard-canvas:v2:${pageKey}:${scopeKey ?? "global"}`;
}

function readCachedProfiles(key: string): RemoteDashboardProfile[] {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as RemoteDashboardProfile[]) : [];
  } catch {
    return [];
  }
}

function writeCachedProfiles(key: string, profiles: readonly RemoteDashboardProfile[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(profiles));
  } catch {
    // Cache is optional. Server persistence remains authoritative.
  }
}

function createCardId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cardsSnapshot(cards: readonly DashboardCard[], layoutPolicy?: DashboardCardLayoutPolicy) {
  return serializeCanvasSnapshot(
    {
      schemaVersion: DASHBOARD_CANVAS_SCHEMA_VERSION,
      cards: [...cards],
    },
    layoutPolicy,
  );
}

function statusLabel(state: SaveState) {
  if (state === "saving") return "Salvando";
  if (state === "saved") return "Salvo";
  if (state === "failure") return "Falha";
  if (state === "conflict") return "Conflito";
  return "Sem perfil ativo";
}

type PresentationStyle = CSSProperties & {
  "--dashboard-font-scale"?: number;
  "--dashboard-bar-scale"?: number;
  "--analytics-ink"?: string;
  "--analytics-cyan-strong"?: string;
  "--dashboard-block-align"?: CSSProperties["justifyContent"];
  "--dashboard-inline-align"?: CSSProperties["alignItems"];
};

function presentationStyle(presentation?: DashboardCardPresentation): PresentationStyle {
  const textAlign = presentation?.textAlign ?? "center";
  const verticalAlign = presentation?.verticalAlign ?? "center";
  return {
    textAlign,
    "--dashboard-font-scale": presentation?.fontScale ?? 1,
    "--dashboard-bar-scale": presentation?.barScale ?? 1,
    "--dashboard-block-align":
      verticalAlign === "start" ? "flex-start" : verticalAlign === "end" ? "flex-end" : "center",
    "--dashboard-inline-align":
      textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center",
    ...(presentation?.textColor ? { "--analytics-ink": presentation.textColor } : {}),
    ...(presentation?.accentColor ? { "--analytics-cyan-strong": presentation.accentColor } : {}),
  };
}

function DashboardCardContent({ card, children }: { card: DashboardCard; children: ReactNode }) {
  return card.presentation ? (
    <div
      className={`${styles.cardContent} ${styles.cardContentPresentation}`}
      data-dashboard-text-align={card.presentation.textAlign ?? "center"}
      data-dashboard-vertical-align={card.presentation.verticalAlign ?? "center"}
      style={presentationStyle(card.presentation)}
    >
      <div className={styles.presentationSurface}>
        {card.presentation.content ? (
          <p className={styles.customContent}>{card.presentation.content}</p>
        ) : null}
        {children}
      </div>
    </div>
  ) : (
    <div className={styles.cardContent}>{children}</div>
  );
}

export function ExpandedDashboardCardContent({
  card,
  children,
  preservePresentation = false,
}: {
  card: DashboardCard;
  children: ReactNode;
  preservePresentation?: boolean;
}) {
  return preservePresentation ? (
    <DashboardCardContent card={card}>{children}</DashboardCardContent>
  ) : (
    children
  );
}

export function ConfigurableDashboardCanvas({
  initialCards,
  catalog,
  compatibility,
  contentByMetricAndType,
  renderCard,
  pageKey,
  scopeKey,
  exportContext,
  onCardsChange,
  ariaLabel = "Dashboard configurável",
  className,
  editable = true,
  profileControls = true,
  automaticProfileName,
  hideCardActionsByDefault = false,
  compactCardControls = false,
  layoutPolicy,
  hideCardOverflow = false,
  addButtonLabel = "Adicionar",
  preserveExpandedPresentation = false,
}: ConfigurableDashboardCanvasProps) {
  const [state, dispatch] = useReducer(canvasReducer, initialCards, (cards) =>
    createCanvasHistoryState(cards, undefined, layoutPolicy),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editorCard, setEditorCard] = useState<DashboardCard | null>(null);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportSelection, setExportSelection] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [profiles, setProfiles] = useState<RemoteDashboardProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesSource, setProfilesSource] = useState<"server" | "cache" | "none">("none");
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileDraftNames, setProfileDraftNames] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const initialSnapshotRef = useRef(cardsSnapshot(initialCards, layoutPolicy));
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);
  const cacheKey = profileCacheKey(pageKey, scopeKey);
  const cards = state.present.cards;
  const serializedCards = useMemo(() => cardsSnapshot(cards, layoutPolicy), [cards, layoutPolicy]);
  const validSelectedIds = useMemo(() => {
    const cardIds = new Set(cards.map(({ id }) => id));
    return new Set([...selectedIds].filter((id) => cardIds.has(id)));
  }, [cards, selectedIds]);
  const activeProfile = profiles.find(({ id }) => id === activeProfileId) ?? null;

  useEffect(() => {
    const next = cardsSnapshot(initialCards, layoutPolicy);
    if (next === initialSnapshotRef.current) return;
    initialSnapshotRef.current = next;
    dispatch({ type: "replace", cards: initialCards, recordHistory: false });
    setSelectedIds(new Set());
  }, [initialCards, layoutPolicy]);

  useEffect(() => {
    onCardsChange?.([...cards]);
  }, [cards, onCardsChange]);

  useEffect(() => {
    if (!state.duplicateCardId) return;
    document
      .querySelector(`[data-dashboard-card-id="${CSS.escape(state.duplicateCardId)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = window.setTimeout(() => dispatch({ type: "clear-duplicate" }), 4_000);
    return () => window.clearTimeout(timeout);
  }, [state.duplicateCardId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setProfilesLoading(true);
      setProfiles([]);
      setProfilesSource("none");
      setActiveProfileId(null);
      setSaveState("idle");
      setProfileMessage("");
      lastSavedSnapshotRef.current = null;
    });
    const query = new URLSearchParams({ pageKey });
    if (scopeKey) query.set("scopeKey", scopeKey);
    void profileRequest<{ profiles: RemoteDashboardProfile[] }>(
      `/api/dashboard-profiles?${query.toString()}`,
    )
      .then(({ profiles: remoteProfiles }) => {
        if (cancelled) return;
        setProfiles(remoteProfiles);
        setProfilesSource("server");
        writeCachedProfiles(cacheKey, remoteProfiles);
        const defaultProfile = remoteProfiles.find(({ isDefault }) => isDefault);
        if (defaultProfile) {
          setActiveProfileId(defaultProfile.id);
          lastSavedSnapshotRef.current = cardsSnapshot(defaultProfile.cards, layoutPolicy);
          dispatch({ type: "replace", cards: defaultProfile.cards, recordHistory: false });
        } else {
          setActiveProfileId(null);
          lastSavedSnapshotRef.current = null;
          setSaveState("idle");
        }
      })
      .catch(() => {
        if (cancelled) return;
        const cached = readCachedProfiles(cacheKey);
        setProfiles(cached);
        setProfilesSource(cached.length > 0 ? "cache" : "none");
        setSaveState("failure");
        setProfileMessage(
          cached.length > 0
            ? "Servidor indisponível. Exibindo o último cache local conhecido."
            : "Não foi possível carregar os perfis.",
        );
        const defaultProfile = cached.find(({ isDefault }) => isDefault);
        if (defaultProfile) {
          setActiveProfileId(defaultProfile.id);
          lastSavedSnapshotRef.current = cardsSnapshot(defaultProfile.cards, layoutPolicy);
          dispatch({ type: "replace", cards: defaultProfile.cards, recordHistory: false });
        }
      })
      .finally(() => {
        if (!cancelled) setProfilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, editable, pageKey, scopeKey, layoutPolicy]);

  useEffect(() => {
    if (
      !editable ||
      profileControls ||
      profilesLoading ||
      profilesSource !== "server" ||
      profiles.length > 0 ||
      !automaticProfileName ||
      saveInFlightRef.current
    ) {
      return;
    }
    saveInFlightRef.current = true;
    setSaveState("saving");
    void profileRequest<{ profile: RemoteDashboardProfile }>("/api/dashboard-profiles", {
      method: "POST",
      body: JSON.stringify({
        pageKey,
        scopeKey: scopeKey ?? null,
        name: automaticProfileName,
        isDefault: true,
        schemaVersion: DASHBOARD_CANVAS_SCHEMA_VERSION,
        cards,
      }),
    })
      .then(({ profile }) => {
        setProfiles([profile]);
        writeCachedProfiles(cacheKey, [profile]);
        setActiveProfileId(profile.id);
        lastSavedSnapshotRef.current = cardsSnapshot(profile.cards, layoutPolicy);
        setSaveState("saved");
        setProfileMessage("");
      })
      .catch(() => {
        setSaveState("failure");
        setProfileMessage("Não foi possível preparar o salvamento automático deste painel.");
      })
      .finally(() => {
        saveInFlightRef.current = false;
      });
  }, [
    automaticProfileName,
    cacheKey,
    cards,
    editable,
    layoutPolicy,
    pageKey,
    profileControls,
    profiles.length,
    profilesLoading,
    profilesSource,
    scopeKey,
  ]);

  useEffect(() => {
    if (!editable || !activeProfile || serializedCards === lastSavedSnapshotRef.current) return;
    const profileId = activeProfile.id;
    const profileVersion = activeProfile.version;
    const timeout = window.setTimeout(() => {
      if (saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      setSaveState("saving");
      void profileRequest<{ profile: RemoteDashboardProfile }>(
        `/api/dashboard-profiles/${encodeURIComponent(profileId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            cards,
            schemaVersion: DASHBOARD_CANVAS_SCHEMA_VERSION,
            version: profileVersion,
          }),
        },
      )
        .then(({ profile }) => {
          lastSavedSnapshotRef.current = serializedCards;
          setProfiles((current) => {
            const next = current.map((entry) => (entry.id === profile.id ? profile : entry));
            writeCachedProfiles(cacheKey, next);
            return next;
          });
          setProfilesSource("server");
          setSaveState("saved");
          setProfileMessage("");
        })
        .catch((error: unknown) => {
          if (error instanceof ProfileRequestError && error.status === 409) {
            setSaveState("conflict");
            setProfileMessage(
              "O perfil mudou em outra sessão. Recarregue a versão remota antes de salvar.",
            );
            return;
          }
          setSaveState("failure");
          setProfileMessage(
            "Falha ao salvar no servidor. A edição local não substituiu o perfil remoto.",
          );
          const fallback = profiles.map((entry) =>
            entry.id === profileId ? { ...entry, cards: [...cards] } : entry,
          );
          writeCachedProfiles(cacheKey, fallback);
        })
        .finally(() => {
          saveInFlightRef.current = false;
        });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [activeProfile, cacheKey, cards, editable, profiles, serializedCards]);

  const renderDashboardContent = useCallback(
    (card: DashboardCard, size: DashboardCardSize) => {
      if (renderCard) return renderCard(card, size);
      return (
        contentByMetricAndType?.[card.metric]?.[card.type] ?? (
          <div className={styles.missingContent} role="status">
            Conteúdo indisponível para {card.metric} em {DEFAULT_CARD_TYPE_LABELS[card.type]}.
          </div>
        )
      );
    },
    [contentByMetricAndType, renderCard],
  );

  function openNewCard() {
    const card = createCatalogCard({
      catalog,
      compatibility,
      id: createCardId(),
      order: cards.length,
    });
    if (!card) return;
    if (layoutPolicy?.freeResize) card.layout.width = 320;
    setEditorMode("add");
    setEditorCard(card);
  }

  function saveEditor(card: DashboardCard) {
    dispatch(
      editorMode === "add"
        ? { type: "add-card", card }
        : { type: "update-card", cardId: card.id, patch: card },
    );
    setEditorCard(null);
  }

  function loadProfile(profile: RemoteDashboardProfile) {
    lastSavedSnapshotRef.current = cardsSnapshot(profile.cards, layoutPolicy);
    setActiveProfileId(profile.id);
    dispatch({ type: "replace", cards: profile.cards, recordHistory: false });
    setSelectedIds(new Set());
    setSaveState("saved");
    setProfileMessage("");
    setShowProfiles(false);
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = profileName.trim();
    if (!name) return;
    setSaveState("saving");
    try {
      const { profile } = await profileRequest<{ profile: RemoteDashboardProfile }>(
        "/api/dashboard-profiles",
        {
          method: "POST",
          body: JSON.stringify({
            pageKey,
            scopeKey: scopeKey ?? null,
            name,
            isDefault: profiles.length === 0,
            schemaVersion: DASHBOARD_CANVAS_SCHEMA_VERSION,
            cards,
          }),
        },
      );
      const next = [...profiles, profile];
      setProfiles(next);
      writeCachedProfiles(cacheKey, next);
      setProfilesSource("server");
      setActiveProfileId(profile.id);
      lastSavedSnapshotRef.current = cardsSnapshot(profile.cards, layoutPolicy);
      setProfileName("");
      setSaveState("saved");
      setProfileMessage("");
    } catch {
      setSaveState("failure");
      setProfileMessage("Não foi possível criar o perfil no servidor.");
    }
  }

  async function renameProfile(profile: RemoteDashboardProfile) {
    const name = (profileDraftNames[profile.id] ?? profile.name).trim();
    if (!name || name === profile.name) return;
    setSaveState("saving");
    try {
      const { profile: renamed } = await profileRequest<{ profile: RemoteDashboardProfile }>(
        `/api/dashboard-profiles/${encodeURIComponent(profile.id)}`,
        { method: "PATCH", body: JSON.stringify({ name, version: profile.version }) },
      );
      setProfiles((current) => {
        const next = current.map((entry) => (entry.id === renamed.id ? renamed : entry));
        writeCachedProfiles(cacheKey, next);
        return next;
      });
      setSaveState("saved");
      setProfileMessage("");
    } catch (error) {
      setSaveState(
        error instanceof ProfileRequestError && error.status === 409 ? "conflict" : "failure",
      );
      setProfileMessage("Não foi possível renomear o perfil.");
    }
  }

  async function setDefaultProfile(profile: RemoteDashboardProfile) {
    setSaveState("saving");
    try {
      const { profile: updated } = await profileRequest<{ profile: RemoteDashboardProfile }>(
        `/api/dashboard-profiles/${encodeURIComponent(profile.id)}/set-default`,
        { method: "POST", body: JSON.stringify({ version: profile.version }) },
      );
      setProfiles((current) => {
        const next = reconcileDefaultProfileChange(current, updated);
        writeCachedProfiles(cacheKey, next);
        return next;
      });
      setSaveState("saved");
      setProfileMessage("");
    } catch (error) {
      setSaveState(
        error instanceof ProfileRequestError && error.status === 409 ? "conflict" : "failure",
      );
      setProfileMessage("Não foi possível definir o perfil padrão.");
    }
  }

  async function deleteProfile(profile: RemoteDashboardProfile) {
    setSaveState("saving");
    try {
      const result = await profileRequest<{
        deletedId: string;
        defaultProfile: RemoteDashboardProfile | null;
      }>(`/api/dashboard-profiles/${encodeURIComponent(profile.id)}?version=${profile.version}`, {
        method: "DELETE",
      });
      const next = profiles
        .filter(({ id }) => id !== result.deletedId)
        .map((entry) =>
          result.defaultProfile && entry.id === result.defaultProfile.id
            ? result.defaultProfile
            : entry,
        );
      setProfiles(next);
      writeCachedProfiles(cacheKey, next);
      setConfirmDeleteId(null);
      if (activeProfileId === profile.id) {
        setActiveProfileId(null);
        lastSavedSnapshotRef.current = null;
        setSaveState("idle");
      } else {
        setSaveState("saved");
      }
      setProfileMessage("");
    } catch (error) {
      setSaveState(
        error instanceof ProfileRequestError && error.status === 409 ? "conflict" : "failure",
      );
      setProfileMessage("Não foi possível excluir o perfil.");
    }
  }

  async function reloadActiveProfile() {
    if (!activeProfileId) return;
    setSaveState("saving");
    const query = new URLSearchParams({ pageKey });
    if (scopeKey) query.set("scopeKey", scopeKey);
    try {
      const { profiles: remoteProfiles } = await profileRequest<{
        profiles: RemoteDashboardProfile[];
      }>(`/api/dashboard-profiles?${query.toString()}`);
      const remote = remoteProfiles.find(({ id }) => id === activeProfileId);
      if (!remote) {
        setSaveState("failure");
        setProfileMessage("O perfil ativo não está mais disponível no servidor.");
        return;
      }
      setProfiles(remoteProfiles);
      writeCachedProfiles(cacheKey, remoteProfiles);
      setProfilesSource("server");
      lastSavedSnapshotRef.current = cardsSnapshot(remote.cards, layoutPolicy);
      dispatch({ type: "replace", cards: remote.cards, recordHistory: false });
      setSelectedIds(new Set());
      setSaveState("saved");
      setProfileMessage("");
    } catch {
      setSaveState("failure");
      setProfileMessage("Não foi possível recarregar o perfil remoto.");
    }
  }

  function moveSelection(direction: -1 | 1) {
    dispatch({
      type: "replace",
      cards: moveSelectedCards(cards, validSelectedIds, direction, layoutPolicy),
      recordHistory: true,
    });
  }

  const expandedCard = cards.find(({ id }) => id === expandedCardId) ?? null;

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      data-hide-card-overflow={hideCardOverflow ? "true" : undefined}
      data-compact-card-controls={compactCardControls ? "true" : undefined}
    >
      {editable ? (
        <div className={styles.toolbar} role="toolbar" aria-label="Ferramentas do dashboard">
          <button
            type="button"
            className={styles.primaryButton}
            onClick={openNewCard}
            disabled={catalog.metrics.length === 0}
          >
            <Plus size={17} aria-hidden="true" /> {addButtonLabel}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "organize" })}
            disabled={cards.length < 2}
          >
            <LayoutGrid size={17} aria-hidden="true" /> Organizar
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "undo" })}
            disabled={state.history.length === 0}
          >
            <Undo2 size={17} aria-hidden="true" /> Desfazer
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "redo" })}
            disabled={state.future.length === 0}
          >
            <Redo2 size={17} aria-hidden="true" /> Refazer
          </button>
          {profileControls ? (
            <button type="button" onClick={() => setShowProfiles(true)}>
              <Users size={17} aria-hidden="true" /> Perfis
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setExportSelection(new Set(cards.map(({ id }) => id)));
              setExportError("");
              setShowExport(true);
            }}
            disabled={cards.length === 0}
          >
            <Download size={17} aria-hidden="true" /> Baixar PDF
          </button>
          {validSelectedIds.size > 0 ? (
            <div className={styles.selectionTools} aria-label="Mover cards selecionados">
              <span>{validSelectedIds.size} selecionado(s)</span>
              <button
                type="button"
                onClick={() => moveSelection(-1)}
                aria-label="Mover grupo para antes"
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => moveSelection(1)}
                aria-label="Mover grupo para depois"
              >
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())}>
                Limpar
              </button>
            </div>
          ) : null}
          <span
            className={styles.saveStatus}
            data-state={saveState}
            role="status"
            aria-live="polite"
          >
            {profileControls
              ? statusLabel(saveState)
              : saveState === "idle"
                ? "Salvamento automático"
                : `${statusLabel(saveState)} automaticamente`}
          </span>
        </div>
      ) : null}

      {profileMessage ? (
        <div
          className={styles.notice}
          data-tone={saveState === "conflict" ? "warning" : "danger"}
          role="alert"
        >
          {profileMessage}
        </div>
      ) : null}
      {state.duplicateCardId ? (
        <div className={styles.notice} data-tone="warning" role="alert">
          Este card já existe. O card original foi realçado.
        </div>
      ) : null}

      {cards.length === 0 ? (
        <div className={styles.emptyState}>
          <LayoutGrid size={28} aria-hidden="true" />
          <h2>Nenhum card no dashboard</h2>
          <p>Adicione uma métrica para montar a visualização.</p>
          {editable ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={openNewCard}
              disabled={catalog.metrics.length === 0}
            >
              Adicionar primeiro card
            </button>
          ) : null}
        </div>
      ) : (
        <DashboardCanvas
          cards={cards}
          disabled={!editable}
          ariaLabel={`${ariaLabel}: cards`}
          onCommit={(next) => dispatch({ type: "replace", cards: next })}
          layoutPolicy={layoutPolicy}
          cornerResizeHandle={layoutPolicy?.maxHeight === null}
          compactControls={compactCardControls}
          renderCard={(card, size) => (
            <div
              className={[
                styles.cardBody,
                hideCardActionsByDefault ? styles.cardBodyActionsHidden : "",
                validSelectedIds.has(card.id) ? styles.cardSelected : "",
                state.duplicateCardId === card.id ? styles.cardDuplicate : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {editable ? (
                <div
                  className={[
                    styles.cardActions,
                    hideCardActionsByDefault ? styles.cardActionsHidden : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-dashboard-export-ignore
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={validSelectedIds.has(card.id)}
                      onChange={(event) => {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(card.id);
                          else next.delete(card.id);
                          return next;
                        });
                      }}
                    />
                    <span className={styles.srOnly}>Selecionar {card.title || card.metric}</span>
                  </label>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={(event) => {
                      setEditorMode("edit");
                      const bounds = event.currentTarget
                        .closest("[data-dashboard-card-id]")
                        ?.getBoundingClientRect();
                      setEditorCard(
                        layoutPolicy?.freeResize
                          ? {
                              ...card,
                              layout: {
                                ...card.layout,
                                width: card.layout.width ?? Math.round(bounds?.width ?? 320),
                              },
                            }
                          : card,
                      );
                    }}
                    aria-label={`Editar ${card.title || card.metric}`}
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => setExpandedCardId(card.id)}
                    aria-label={`Expandir ${card.title || card.metric}`}
                  >
                    <Expand size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => dispatch({ type: "remove-card", cardId: card.id })}
                    aria-label={`Excluir ${card.title || card.metric}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
              <DashboardCardContent card={card}>
                {renderDashboardContent(card, size)}
              </DashboardCardContent>
            </div>
          )}
        />
      )}

      {editorCard ? (
        <CardEditor
          card={editorCard}
          mode={editorMode}
          catalog={catalog}
          compatibility={compatibility}
          layoutPolicy={layoutPolicy}
          onClose={() => setEditorCard(null)}
          onDelete={
            editorMode === "edit"
              ? () => {
                  dispatch({ type: "remove-card", cardId: editorCard.id });
                  setEditorCard(null);
                }
              : undefined
          }
          onSave={saveEditor}
        />
      ) : null}

      {expandedCard ? (
        <DashboardModal
          title={
            expandedCard.title ||
            catalog.metrics.find(({ key }) => key === expandedCard.metric)?.label ||
            expandedCard.metric
          }
          description="Visualização ampliada do mesmo conteúdo do card."
          onClose={() => setExpandedCardId(null)}
          wide
        >
          <div className={styles.expandedContent}>
            <ExpandedDashboardCardContent
              card={expandedCard}
              preservePresentation={preserveExpandedPresentation}
            >
              {renderDashboardContent(expandedCard, { width: 960, height: 540 })}
            </ExpandedDashboardCardContent>
          </div>
        </DashboardModal>
      ) : null}

      {showProfiles ? (
        <DashboardModal
          title="Perfis do dashboard"
          description="Perfis são salvos no servidor. O cache local só é usado quando o servidor falha."
          onClose={() => setShowProfiles(false)}
          wide
        >
          <div className={styles.profileMeta}>
            <span>
              Origem:{" "}
              {profilesSource === "server"
                ? "servidor"
                : profilesSource === "cache"
                  ? "cache local"
                  : "indisponível"}
            </span>
            <span>{statusLabel(saveState)}</span>
          </div>
          <form className={styles.createProfile} onSubmit={createProfile}>
            <label>
              Nome do novo perfil
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                maxLength={80}
                required
              />
            </label>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={!profileName.trim() || saveState === "saving"}
            >
              <Save size={16} aria-hidden="true" /> Salvar perfil atual
            </button>
          </form>
          {profilesLoading ? <p role="status">Carregando perfis…</p> : null}
          {!profilesLoading && profiles.length === 0 ? <p>Nenhum perfil disponível.</p> : null}
          <ul className={styles.profileList}>
            {profiles.map((profile) => (
              <li key={profile.id} data-active={profile.id === activeProfileId}>
                <div className={styles.profileHeading}>
                  <strong>{profile.name}</strong>
                  {profile.isDefault ? <span>Padrão</span> : null}
                  {profile.id === activeProfileId ? <span>Ativo</span> : null}
                </div>
                <label>
                  Renomear
                  <input
                    value={profileDraftNames[profile.id] ?? profile.name}
                    maxLength={80}
                    onChange={(event) =>
                      setProfileDraftNames((current) => ({
                        ...current,
                        [profile.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className={styles.profileActions}>
                  <button type="button" onClick={() => loadProfile(profile)}>
                    Carregar
                  </button>
                  <button type="button" onClick={() => void renameProfile(profile)}>
                    Renomear
                  </button>
                  <button
                    type="button"
                    onClick={() => void setDefaultProfile(profile)}
                    disabled={profile.isDefault}
                  >
                    Tornar padrão
                  </button>
                  {confirmDeleteId === profile.id ? (
                    <>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => void deleteProfile(profile)}
                      >
                        Confirmar exclusão
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => setConfirmDeleteId(profile.id)}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {saveState === "conflict" ? (
            <button
              type="button"
              onClick={() => void reloadActiveProfile()}
              disabled={!activeProfileId}
            >
              <RotateCcw size={16} aria-hidden="true" /> Recarregar versão remota
            </button>
          ) : null}
        </DashboardModal>
      ) : null}

      {showExport ? (
        <DashboardModal
          title="Baixar dashboard em PDF"
          description="Selecione os cards. O PDF preserva a ordem atual, o contexto e a visualização de cada gráfico."
          onClose={() => {
            if (!exporting) setShowExport(false);
          }}
          footer={
            <>
              <button type="button" onClick={() => setShowExport(false)} disabled={exporting}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={exporting || exportSelection.size === 0}
                onClick={() => {
                  setExporting(true);
                  setExportError("");
                  void downloadDashboardPdf({
                    cards: cards.filter(({ id }) => exportSelection.has(id)),
                    catalog,
                    exportContext,
                    cardElements: cards
                      .filter(({ id }) => exportSelection.has(id))
                      .map(({ id }) =>
                        document.querySelector<HTMLElement>(
                          `[data-dashboard-card-id="${CSS.escape(id)}"]`,
                        ),
                      )
                      .filter((element): element is HTMLElement => Boolean(element)),
                  })
                    .then(() => setShowExport(false))
                    .catch((error: unknown) =>
                      setExportError(
                        error instanceof Error ? error.message : "Falha ao gerar o PDF.",
                      ),
                    )
                    .finally(() => setExporting(false));
                }}
              >
                <Download size={16} aria-hidden="true" /> {exporting ? "Gerando…" : "Baixar PDF"}
              </button>
            </>
          }
        >
          <div className={styles.exportContext}>
            <strong>{exportContext.title}</strong>
            {exportContext.context ? <span>Contexto: {exportContext.context}</span> : null}
            {exportContext.filters ? <span>Filtros: {exportContext.filters}</span> : null}
            {exportContext.source ? <span>Fonte: {exportContext.source}</span> : null}
            {exportContext.generatedAt ? <span>Horário: {exportContext.generatedAt}</span> : null}
          </div>
          <fieldset className={styles.exportList}>
            <legend>Cards na ordem atual</legend>
            {cards.map((card, index) => (
              <label key={card.id}>
                <input
                  type="checkbox"
                  checked={exportSelection.has(card.id)}
                  onChange={(event) =>
                    setExportSelection((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(card.id);
                      else next.delete(card.id);
                      return next;
                    })
                  }
                />
                {index + 1}.{" "}
                {card.title ||
                  catalog.metrics.find(({ key }) => key === card.metric)?.label ||
                  card.metric}
              </label>
            ))}
          </fieldset>
          {exportError ? (
            <p className={styles.errorText} role="alert">
              {exportError}
            </p>
          ) : null}
        </DashboardModal>
      ) : null}
    </section>
  );
}

function CardEditor({
  card: initialCard,
  mode,
  catalog,
  compatibility,
  layoutPolicy,
  onClose,
  onDelete,
  onSave,
}: {
  card: DashboardCard;
  mode: "add" | "edit";
  catalog: ConfigurableDashboardCatalog;
  compatibility?: ConfigurableDashboardCompatibility | undefined;
  layoutPolicy?: DashboardCardLayoutPolicy | undefined;
  onClose: () => void;
  onDelete?: (() => void) | undefined;
  onSave: (card: DashboardCard) => void;
}) {
  const [card, setCard] = useState(initialCard);
  const types = compatibleTypes(card.metric, compatibility);
  const groups = compatibleGroups(card.metric, compatibility);
  const periods = compatiblePeriods(card.metric, compatibility);
  const optionKeys = compatibleOptions(card.metric, catalog, compatibility);
  const typeChoices =
    catalog.types ?? types.map((value) => ({ value, label: DEFAULT_CARD_TYPE_LABELS[value] }));
  const periodChoices =
    catalog.periods ?? periods.map((value) => ({ value, label: DEFAULT_PERIOD_LABELS[value] }));
  const groupChoices =
    catalog.groups ?? groups.map((value) => ({ value, label: DEFAULT_GROUP_LABELS[value] }));
  const optionChoices =
    catalog.options ?? optionKeys.map((key) => ({ key, label: DEFAULT_OPTION_LABELS[key] }));

  function updateMetric(metric: string) {
    const configured = catalog.metrics.find(({ key }) => key === metric);
    const next = reconcileCardCompatibility(
      { ...card, metric, type: configured?.defaultType ?? card.type },
      catalog,
      compatibility,
      layoutPolicy,
    );
    setCard(next);
  }

  function updateOption(key: DashboardCardOptionKey, enabled: boolean) {
    const options: DashboardCardOptions = { ...card.options, [key]: enabled };
    setCard({ ...card, options });
  }

  function updatePresentation(patch: Partial<DashboardCardPresentation>) {
    setCard({ ...card, presentation: { ...card.presentation, ...patch } });
  }

  const layoutLimits = DASHBOARD_CARD_LAYOUT_LIMITS[card.type];

  const customDatesValid =
    card.period !== "custom" ||
    Boolean(card.startDate && card.endDate && card.startDate <= card.endDate);

  return (
    <DashboardModal
      title={mode === "add" ? "Adicionar card" : "Editar card"}
      description="A combinação de métrica, modelo, período, agrupamento e entidades não pode duplicar outro card."
      onClose={onClose}
      footer={
        <>
          {onDelete ? (
            <button type="button" className={styles.dangerButton} onClick={onDelete}>
              <Trash2 size={16} aria-hidden="true" /> Excluir
            </button>
          ) : null}
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="dashboard-card-editor"
            className={styles.primaryButton}
            disabled={!customDatesValid}
          >
            <Save size={16} aria-hidden="true" /> {mode === "add" ? "Adicionar" : "Salvar"}
          </button>
        </>
      }
    >
      <form
        id="dashboard-card-editor"
        className={styles.editorForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (customDatesValid) onSave(card);
        }}
      >
        <label>
          Título
          <input
            value={card.title ?? ""}
            maxLength={120}
            placeholder="Opcional"
            onChange={(event) => {
              const next = { ...card };
              if (event.target.value) next.title = event.target.value;
              else delete next.title;
              setCard(next);
            }}
          />
        </label>
        <label>
          Texto complementar
          <textarea
            value={card.presentation?.content ?? ""}
            maxLength={240}
            rows={3}
            placeholder="Opcional; os valores calculados continuam automáticos"
            onChange={(event) => updatePresentation({ content: event.target.value })}
          />
        </label>
        <label>
          Largura do card
          <input
            type="number"
            min={layoutPolicy?.freeResize ? FREE_CARD_MIN_WIDTH : layoutLimits.minColumnSpan}
            max={layoutPolicy?.freeResize ? FREE_CARD_MAX_SIZE : 12}
            step={1}
            value={layoutPolicy?.freeResize ? (card.layout.width ?? 320) : card.layout.columnSpan}
            onChange={(event) =>
              setCard({
                ...card,
                layout: constrainCardLayout(
                  card.type,
                  {
                    ...card.layout,
                    ...(layoutPolicy?.freeResize
                      ? { width: Number(event.target.value) }
                      : { columnSpan: Number(event.target.value) }),
                  },
                  layoutPolicy,
                ),
              })
            }
          />
          <small>
            {layoutPolicy?.freeResize
              ? `${card.layout.width ?? 320}px`
              : `${card.layout.columnSpan} de 12 colunas`}
          </small>
        </label>
        <label>
          Altura do card
          <input
            type="number"
            min={layoutPolicy?.freeResize ? FREE_CARD_MIN_HEIGHT : layoutLimits.minHeight}
            max={
              layoutPolicy?.maxHeight === null
                ? undefined
                : (layoutPolicy?.maxHeight ?? layoutLimits.maxHeight)
            }
            step={layoutPolicy?.heightStep ?? 24}
            value={card.layout.height}
            onChange={(event) =>
              setCard({
                ...card,
                layout: constrainCardLayout(
                  card.type,
                  {
                    ...card.layout,
                    height: Number(event.target.value),
                  },
                  layoutPolicy,
                ),
              })
            }
          />
          <small>{card.layout.height}px</small>
        </label>
        <label>
          Tamanho da fonte
          <input
            type="range"
            min={75}
            max={150}
            step={5}
            value={Math.round((card.presentation?.fontScale ?? 1) * 100)}
            onChange={(event) =>
              updatePresentation({ fontScale: Number(event.target.value) / 100 })
            }
          />
          <small>{Math.round((card.presentation?.fontScale ?? 1) * 100)}%</small>
        </label>
        <label>
          Alinhamento horizontal
          <select
            value={card.presentation?.textAlign ?? "center"}
            onChange={(event) =>
              updatePresentation({
                textAlign: event.target.value as NonNullable<
                  DashboardCardPresentation["textAlign"]
                >,
              })
            }
          >
            <option value="left">Esquerda</option>
            <option value="center">Centro</option>
            <option value="right">Direita</option>
          </select>
        </label>
        <label>
          Posição vertical
          <select
            value={card.presentation?.verticalAlign ?? "center"}
            onChange={(event) =>
              updatePresentation({
                verticalAlign: event.target.value as NonNullable<
                  DashboardCardPresentation["verticalAlign"]
                >,
              })
            }
          >
            <option value="start">Topo</option>
            <option value="center">Centro</option>
            <option value="end">Base</option>
          </select>
        </label>
        <label>
          Cor do texto
          <input
            type="color"
            value={card.presentation?.textColor ?? "#d9e8f2"}
            onChange={(event) => updatePresentation({ textColor: event.target.value })}
          />
        </label>
        <label>
          Cor do gráfico e destaques
          <input
            type="color"
            value={card.presentation?.accentColor ?? "#55c4dc"}
            onChange={(event) => updatePresentation({ accentColor: event.target.value })}
          />
        </label>
        {card.type === "bars" || card.type === "horizontal-bars" ? (
          <label>
            Altura ou alcance das torres
            <input
              type="range"
              min={50}
              max={150}
              step={5}
              value={Math.round((card.presentation?.barScale ?? 1) * 100)}
              onChange={(event) =>
                updatePresentation({ barScale: Number(event.target.value) / 100 })
              }
            />
            <small>{Math.round((card.presentation?.barScale ?? 1) * 100)}%</small>
          </label>
        ) : null}
        <label>
          Métrica
          <select value={card.metric} onChange={(event) => updateMetric(event.target.value)}>
            {catalog.metrics.map((metric) => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Modelo
          <select
            value={card.type}
            onChange={(event) =>
              setCard(
                reconcileCardCompatibility(
                  { ...card, type: event.target.value as DashboardCardType },
                  catalog,
                  compatibility,
                  layoutPolicy,
                ),
              )
            }
          >
            {typeChoices
              .filter(({ value }) => types.includes(value))
              .map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Agrupamento
          <select
            value={card.groupBy}
            onChange={(event) =>
              setCard({ ...card, groupBy: event.target.value as DashboardGroupBy })
            }
          >
            {groupChoices
              .filter(({ value }) => groups.includes(value))
              .map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Período
          <select
            value={card.period}
            onChange={(event) => {
              const period = event.target.value as DashboardPeriod;
              const next = { ...card, period };
              if (period !== "custom") {
                delete next.startDate;
                delete next.endDate;
              }
              setCard(next);
            }}
          >
            {periodChoices
              .filter(({ value }) => periods.includes(value))
              .map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        {card.period === "custom" ? (
          <div className={styles.dateFields}>
            <label>
              Data inicial
              <input
                type="date"
                value={card.startDate ?? ""}
                required
                onChange={(event) => setCard({ ...card, startDate: event.target.value })}
              />
            </label>
            <label>
              Data final
              <input
                type="date"
                value={card.endDate ?? ""}
                required
                onChange={(event) => setCard({ ...card, endDate: event.target.value })}
              />
            </label>
            {!customDatesValid ? (
              <p role="alert">A data final deve ser igual ou posterior à data inicial.</p>
            ) : null}
          </div>
        ) : null}
        {catalog.entities && catalog.entities.length > 0 ? (
          <fieldset className={styles.choiceGroup}>
            <legend>Entidades</legend>
            <label>
              <input
                type="checkbox"
                checked={card.entityIds === null}
                onChange={(event) =>
                  setCard({ ...card, entityIds: event.target.checked ? null : [] })
                }
              />
              Todas as entidades
            </label>
            {catalog.entities.map((entity) => (
              <label key={entity.id}>
                <input
                  type="checkbox"
                  disabled={card.entityIds === null}
                  checked={card.entityIds?.includes(entity.id) ?? false}
                  onChange={(event) => {
                    const current = card.entityIds ?? [];
                    setCard({
                      ...card,
                      entityIds: event.target.checked
                        ? [...current, entity.id]
                        : current.filter((id) => id !== entity.id),
                    });
                  }}
                />
                {entity.label}
              </label>
            ))}
          </fieldset>
        ) : null}
        {optionKeys.length > 0 ? (
          <fieldset className={styles.choiceGroup}>
            <legend>Opções</legend>
            {optionChoices
              .filter(({ key }) => optionKeys.includes(key))
              .map(({ key, label }) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={card.options?.[key] ?? false}
                    onChange={(event) => updateOption(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
          </fieldset>
        ) : null}
      </form>
    </DashboardModal>
  );
}
