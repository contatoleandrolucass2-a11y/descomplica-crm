import { z } from "zod";

import type { UsefulLinksPage, UsefulLinksSection } from "./content";

const safeId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine((value) => !["__proto__", "prototype", "constructor"].includes(value));

const externalHref = z
  .string()
  .max(2_000)
  .refine((value) => /^(https?:\/\/|tel:|mailto:)/i.test(value), "Destino inválido");

export const usefulLinksLayoutSchema = z
  .object({
    order: z.number().int().min(0).max(49),
    columnSpan: z.number().int().min(3).max(12),
    height: z.number().int().min(220).max(1_200),
  })
  .strict();

export const usefulLinksItemSchema = z
  .object({
    id: safeId,
    label: z.string().trim().min(1).max(240),
    href: externalHref.nullable(),
    description: z.string().trim().max(2_000),
  })
  .strict();

export const usefulLinksTableSchema = z
  .object({
    headers: z.array(z.string().trim().min(1).max(160)).min(1).max(12),
    rows: z.array(z.array(z.string().trim().max(500)).min(1).max(12)).max(100),
  })
  .strict()
  .refine(
    ({ headers, rows }) => rows.every((row) => row.length === headers.length),
    "Todas as linhas da tabela devem ter o mesmo número de colunas do cabeçalho.",
  );

export const usefulLinksSectionCardSchema = z
  .object({
    id: safeId,
    kind: z.literal("section"),
    title: z.string().trim().min(1).max(160),
    paragraphs: z.array(z.string().trim().min(1).max(4_000)).max(20),
    items: z.array(usefulLinksItemSchema).max(40),
    table: usefulLinksTableSchema.nullable(),
    layout: usefulLinksLayoutSchema,
  })
  .strict();

export const usefulLinksOrgNodeSchema = z
  .object({
    id: safeId,
    parentId: safeId.nullable(),
    role: z.string().trim().min(1).max(120),
    name: z.string().trim().max(160),
    phone: z.string().trim().max(40),
    href: externalHref.nullable(),
    order: z.number().int().min(0).max(99),
  })
  .strict();

export const usefulLinksOrgChartCardSchema = z
  .object({
    id: safeId,
    kind: z.literal("org-chart"),
    title: z.string().trim().min(1).max(160),
    note: z.string().trim().max(1_000),
    nodes: z.array(usefulLinksOrgNodeSchema).min(1).max(50),
    layout: usefulLinksLayoutSchema,
  })
  .strict()
  .superRefine(({ nodes }, context) => {
    const ids = new Set(nodes.map(({ id }) => id));
    if (ids.size !== nodes.length) {
      context.addIssue({ code: "custom", message: "Os integrantes precisam de IDs únicos." });
      return;
    }
    for (const node of nodes) {
      if (node.parentId === node.id || (node.parentId && !ids.has(node.parentId))) {
        context.addIssue({
          code: "custom",
          message: `A liderança informada para ${node.role} não existe.`,
        });
      }
      const visited = new Set<string>([node.id]);
      let parentId = node.parentId;
      while (parentId) {
        if (visited.has(parentId)) {
          context.addIssue({ code: "custom", message: "O organograma não pode conter ciclos." });
          break;
        }
        visited.add(parentId);
        parentId = nodes.find(({ id }) => id === parentId)?.parentId ?? null;
      }
    }
  });

export const usefulLinksCardSchema = z.discriminatedUnion("kind", [
  usefulLinksSectionCardSchema,
  usefulLinksOrgChartCardSchema,
]);

export const usefulLinksDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    pageKey: z.string().regex(/^crm\.useful_links(?:\.[a-z0-9_]+)?$/),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    cards: z.array(usefulLinksCardSchema).min(1).max(50),
    updatedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine(({ cards }, context) => {
    const ids = new Set(cards.map(({ id }) => id));
    const orders = new Set(cards.map(({ layout }) => layout.order));
    if (ids.size !== cards.length)
      context.addIssue({ code: "custom", message: "Os cards precisam de IDs únicos." });
    if (orders.size !== cards.length)
      context.addIssue({ code: "custom", message: "Os cards precisam de posições únicas." });
  });

export type UsefulLinksDocument = z.infer<typeof usefulLinksDocumentSchema>;
export type UsefulLinksCard = z.infer<typeof usefulLinksCardSchema>;
export type UsefulLinksSectionCard = z.infer<typeof usefulLinksSectionCardSchema>;
export type UsefulLinksOrgChartCard = z.infer<typeof usefulLinksOrgChartCardSchema>;

function slugId(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "card";
}

function itemFromSection(section: UsefulLinksSection, sectionIndex: number) {
  return (section.items ?? []).map((item, itemIndex) => ({
    id: `item-${sectionIndex + 1}-${itemIndex + 1}`,
    label: item.label,
    href: item.href ?? null,
    description: item.description ?? "",
  }));
}

function sectionCard(
  section: UsefulLinksSection,
  index: number,
  page: UsefulLinksPage,
): UsefulLinksSectionCard {
  const hasTable = Boolean(section.table);
  const isStores = page.slug === "lojas-horarios";
  return {
    id: `${slugId(section.title)}-${index + 1}`,
    kind: "section",
    title: section.title,
    paragraphs: section.paragraphs ?? [],
    items: itemFromSection(section, index),
    table: section.table ?? null,
    layout: {
      order: index,
      columnSpan: hasTable || index === 0 ? 12 : 6,
      height: hasTable ? 520 : isStores ? 320 : 360,
    },
  };
}

function whatsappCards(page: UsefulLinksPage): UsefulLinksCard[] {
  const byTitle = new Map(page.sections.map((section) => [section.title, section]));
  const supporting = [
    "Acessar os grupos das CCAs",
    "Comunidade Direcional",
    "Grupo de propostas — unidades Direcional",
    "Grupo de apoio",
  ].map((title, index) => sectionCard(byTitle.get(title)!, index + 1, page));
  return [
    {
      id: "organograma-comercial",
      kind: "org-chart",
      title: "Organograma comercial",
      note: "Os ícones e números abrem o WhatsApp quando existe um destino válido.",
      nodes: [
        {
          id: "diretor-comercial",
          parentId: null,
          role: "Diretor Comercial",
          name: "Leandro",
          phone: "(11) 91715-3404",
          href: "https://wa.me/5511917153404",
          order: 0,
        },
        {
          id: "diretor-vendas",
          parentId: "diretor-comercial",
          role: "Diretor de Vendas",
          name: "Fabricio",
          phone: "(11) 91981-2845",
          href: "https://wa.me/5511919812845",
          order: 1,
        },
        ...[
          ["July", "(11) 98485-7817", "5511984857817"],
          ["Álvaro", "(11) 97572-9327", "5511975729327"],
          ["Richard", "(11) 98989-0555", "5511989890555"],
          ["Lucas", "(11) 98396-2016", ""],
        ].map(([name, phone, destination], index) => ({
          id: `gerente-regional-${index + 1}`,
          parentId: "diretor-vendas",
          role: "Gerente Regional",
          name: name!,
          phone: phone!,
          href: destination ? `https://wa.me/${destination}` : null,
          order: index + 2,
        })),
      ],
      layout: { order: 0, columnSpan: 12, height: 560 },
    },
    ...supporting.map((card, index) => ({
      ...card,
      layout: { ...card.layout, order: index + 1, columnSpan: 12, height: 420 },
    })),
  ];
}

export function usefulLinksPageKey(slug: string) {
  return `crm.useful_links.${slug.replaceAll("-", "_")}`;
}

export function createDefaultUsefulLinksDocument(page: UsefulLinksPage): UsefulLinksDocument {
  return {
    schemaVersion: 1,
    pageKey: usefulLinksPageKey(page.slug),
    revision: 0,
    cards:
      page.slug === "grupos-whatsapp"
        ? whatsappCards(page)
        : page.sections.map((section, index) => sectionCard(section, index, page)),
    updatedAt: null,
  };
}
