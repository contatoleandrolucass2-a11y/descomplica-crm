import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvestorLearningManual } from "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator";
import {
  ASSOCIATIVE_FAQ_REFERENCE,
  ASSOCIATIVE_FAQ_SECTIONS,
} from "../app/(protected)/app/simulacao/_components/archive-investor/associative-faq-content";
import { ASSOCIATIVE_FIELD_GUIDE } from "../app/(protected)/app/simulacao/_components/archive-investor/associative-learning-content";

const questions = ASSOCIATIVE_FAQ_SECTIONS.flatMap((section) => section.questions);
const answer = (id: number) => {
  const value = questions.find((question) => question.id === id)?.answer;
  return typeof value === "string" ? value : (value ?? []).join("\n");
};

describe("FAQ Associativo: material de referência de 30/09/2026", () => {
  it("preserves the 43 numbered questions in their original order and categories", () => {
    expect(questions.map(({ id }) => id)).toEqual(Array.from({ length: 43 }, (_, i) => i + 1));
    expect(new Set(questions.map(({ question }) => question)).size).toBe(43);
    expect(ASSOCIATIVE_FAQ_SECTIONS.map(({ questions: group }) => group.length)).toEqual([
      3, 6, 8, 3, 8, 5, 5, 5,
    ]);
    expect(questions[0]?.question).toBe("O que são HIS, HMP e R2V?");
    expect(questions[42]?.question).toBe("O que é fluxo linear e fluxo decrescente?");
  });

  it("keeps financial limits, examples and qualifications from the supplied text", () => {
    const required: Record<number, string[]> = {
      2: [
        "4.863,00",
        "9.726,00",
        "16.210,00",
        "276.102,20",
        "383.636,74",
        "537.672,71",
        "810,50",
        "1.621,00",
        "2.431,50",
      ],
      7: [
        "R$ 5 mil",
        "R$ 55 mil",
        "máximo não é garantido",
        "R$ 250 mil",
        "R$ 20 mil",
        "R$ 230 mil",
      ],
      8: ["4.863,00", "R$ 16 mil", "não comprova"],
      9: ["8%", "três anos", "consecutivos ou não"],
      12: ["60 dias", "não é regra universal", "financiamento garantido"],
      13: ["SAC", "Price", "taxa mensal", "quantidade de parcelas", "0,5%", "1,5%"],
      16: ["R$ 200 mil", "R$ 80 mil", "0,6%", "R$ 480", "K59"],
      17: ["menor", "R$ 250 mil", "R$ 240 mil", "80%", "R$ 192 mil"],
      18: [
        "3.200,00",
        "3.200,01",
        "5.000,00",
        "5.000,01",
        "9.600,00",
        "9.600,01",
        "13.000,00",
        "R$ 210 mil",
        "R$ 275 mil",
        "R$ 400 mil",
        "R$ 600 mil",
      ],
      20: ["50%", "artigo 290", "245.527,77", "não significa desconto de 50% em todos"],
      23: [
        "D48",
        "anuais válidas nominais",
        "preço − bônus − desconto",
        "R$ 45 mil",
        "R$ 250 mil",
        "18%",
      ],
      24: ["J59", "R$ 600", "R$ 4 mil", "15%", "não representa todo o orçamento"],
      25: ["M59", "K59", "30%", "R$ 1.200", "R$ 1.800", "45%", "não uma regra universal"],
      29: ["INCC", "Habite-se", "IPCA", "1% ao mês", "daquele contrato"],
      30: ["0,5%", "12 meses", "1,005", "1.061,68", "solicitar devolução", "não transforma"],
      34: ["Bonificação de 100%", "adimplência", "não aplica automaticamente"],
      35: [
        "725.808,00",
        "120.968,00",
        "0,5%",
        "3%",
        "144.032",
        "4.925,80",
        "R$ 300",
        "R$ 1.000",
        "não tarifas oficiais universais",
      ],
      36: ["B52", "B53", "1,5%", "36", "40", "Não significa acrescentar automaticamente INCC"],
      37: ["4002-2600"],
      38: ["Pode Morar", "Habitação CAIXA"],
      39: ["R$ 150", "Sinal 1", "Sinal 2", "Sinal 3", "5, 10 ou 15", "30 dias", "31 dias"],
      41: [
        "80%",
        "90%",
        "VMD",
        "Não informa seu valor numérico",
        "quitou integralmente",
        "suportado pela empresa",
        "Não há base para inventar",
      ],
      42: [
        "50%",
        "R$ 4.000",
        "R$ 2.000",
        "D37:E41",
        "cinco",
        "15 de dezembro",
        "não 50% da renda anual",
        "1,005",
      ],
      43: ["40%, 30%, 20% e 10%", "B64, B68, B72 e B76", "WF-13B", "Não são a mesma coisa que SAC"],
    };
    for (const [id, fragments] of Object.entries(required)) {
      for (const fragment of fragments)
        expect(answer(Number(id)), `Pergunta ${id}`).toContain(fragment);
    }
  });

  it("distinguishes reference formulas, current page estimates and official decisions", () => {
    expect(answer(16)).toContain("renda familiar × 30% × andamento estimado");
    expect(answer(16)).toContain("terceiro mês programado");
    expect(answer(16)).toContain("congelado em 100%");
    expect(answer(16)).toContain("não significa cobrança real de juros de obra após a conclusão");
    expect(answer(18)).toContain("teto simplificado");
    expect(answer(20)).toContain("força SBPE");
    expect(answer(20)).toContain("primeira aquisição ou enquadramento no MCMV");
    expect(answer(23)).toContain(
      "A fórmula relatada para D48 não deve ser apresentada como a fórmula atual",
    );
    expect(answer(24)).toContain("escolhe a maior");
    expect(answer(25)).toContain("não inclui o valor da anual");
    expect(answer(28)).toContain("o mês da entrega já integra o pós-obra");
    expect(answer(35)).toContain("sem distinguir todas as modalidades tributárias");
    expect(answer(39)).toContain("não impõe Sinal 1 menor ou igual à entrada");
    expect(answer(41)).toContain("não são uma regra universal");
    expect(answer(43)).toContain("não comprova equivalência nem execução");
  });

  it("attributes inaccessible financial attachments without private identifiers or citation debris", () => {
    expect(ASSOCIATIVE_FAQ_REFERENCE).toContain("01/10/2026");
    expect(ASSOCIATIVE_FAQ_REFERENCE).toContain(
      "não foram disponibilizados para conferência direta",
    );
    const content = JSON.stringify(ASSOCIATIVE_FAQ_SECTIONS);
    expect(content).not.toMatch(
      /D4Sign|00_ORQUESTRADOR|07_PARCELA|ITEM_CRITICO||turn\d+(?:search|view)/,
    );
    expect(content).not.toMatch(
      /contrato (?:enviado|analisado|anexado)|sua planilha|você enviou|no seu simulador/i,
    );
    for (const id of [12, 23, 29, 30, 34, 36, 41]) {
      expect(answer(id)).toContain("material de referência fornecido");
    }
    expect(answer(32)).toContain("A fonte oficial do IPCA é o IBGE");
  });

  it("renders every full answer as paragraphs, with headings and native disclosures", () => {
    const html = renderToStaticMarkup(<InvestorLearningManual associative />);
    expect(html).toContain(ASSOCIATIVE_FAQ_REFERENCE);
    for (const section of ASSOCIATIVE_FAQ_SECTIONS) {
      expect(html).toContain(`>${section.title}</h4>`);
      for (const item of section.questions) {
        expect(html).toContain(
          renderToStaticMarkup(<summary>{`${item.id}. ${item.question}`}</summary>),
        );
        const paragraphs = typeof item.answer === "string" ? [item.answer] : item.answer;
        for (const paragraph of paragraphs) {
          expect(html).toContain(renderToStaticMarkup(<p>{paragraph}</p>));
        }
      }
    }
    expect(html.match(/<details>/g)).toHaveLength(43 + 5 + 27);
    expect(ASSOCIATIVE_FIELD_GUIDE).toHaveLength(27);
    for (const field of ASSOCIATIVE_FIELD_GUIDE) {
      expect(html).toContain(`<summary>${field.label}</summary>`);
    }
    expect(html).not.toContain("[object Object]");
  });

  it("links each public reference to its verified publisher in the rendered answer", () => {
    const html = renderToStaticMarkup(<InvestorLearningManual associative />);
    const hosts = new Set([
      "legislacao.prefeitura.sp.gov.br",
      "www.gov.br",
      "www.bcb.gov.br",
      "www.habitacao.sp.gov.br",
      "www.planalto.gov.br",
      "www.caixa.gov.br",
      "ri.direcional.com.br",
      "prefeitura.sp.gov.br",
      "portalibre.fgv.br",
      "www.ibge.gov.br",
      "www.direcional.com.br",
    ]);
    for (const item of questions) {
      for (const source of item.sources ?? []) {
        const url = new URL(source.href);
        expect(url.protocol).toBe("https:");
        expect(hosts.has(url.hostname)).toBe(true);
        expect(html).toContain(
          renderToStaticMarkup(
            <a href={source.href} target="_blank" rel="noopener noreferrer">
              {source.label}
              <span aria-hidden="true">↗</span>
            </a>,
          ),
        );
      }
    }
  });

  it.each([{ directTable: true }, {}])(
    "does not insert the Associativo FAQ in other manuals: %j",
    (props) => {
      const html = renderToStaticMarkup(<InvestorLearningManual {...props} />);
      expect(html).not.toContain(ASSOCIATIVE_FAQ_REFERENCE);
      expect(html).not.toContain("43. O que é fluxo linear e fluxo decrescente?");
    },
  );
});
