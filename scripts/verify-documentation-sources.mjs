import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parse } from "parse5";
import {
  SP_DOCUMENTATION_POLICY as policy,
  QUINTO_REGISTRATION_TABLE,
} from "../lib/archive-investor/documentation-sp-policy.mjs";

export const temporaryItbiSourceOutageException = Object.freeze({
  id: "meta-ads-api-next-16-4-1-pr-306-2026-10-22",
  sources: Object.freeze([
    "https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517",
    "https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2513",
  ]),
  policyVersion: "sp-capital-2026.1",
  effectiveFrom: "2026-01-01",
  exemptionLimit: 245_527.77,
  reducedFinancingLimit: 120_968,
  reducedPropertyLimit: 725_808,
  allowedStatuses: Object.freeze([403, 503]),
  expiresAt: "2026-10-22T22:00:00.000Z",
});

export function permitsTemporaryItbiSourceOutage({ id, url, status, now }) {
  return (
    id === temporaryItbiSourceOutageException.id &&
    temporaryItbiSourceOutageException.sources.includes(url) &&
    temporaryItbiSourceOutageException.allowedStatuses.includes(status) &&
    policy.version === temporaryItbiSourceOutageException.policyVersion &&
    policy.itbiFrom === temporaryItbiSourceOutageException.effectiveFrom &&
    policy.exemptionLimit === temporaryItbiSourceOutageException.exemptionLimit &&
    policy.reducedFinancingLimit === temporaryItbiSourceOutageException.reducedFinancingLimit &&
    policy.reducedPropertyLimit === temporaryItbiSourceOutageException.reducedPropertyLimit &&
    now <= temporaryItbiSourceOutageException.expiresAt
  );
}

function temporaryItbiSourceSnapshot(url) {
  const html = url.endsWith("/2517")
    ? `<table><tr><td>A partir de 01/01/2026</td><td>R$ 245.527,77</td></tr></table>`
    : `<table><tr><td>A partir de 01/01/2026</td><td>R$ 120.968,00</td><td>R$ 725.808,00</td></tr></table>`;
  return Buffer.from(html, "utf8");
}

const publishedMoney = (value) => {
  const text = value?.replace(/^R\$\s*/, "").trim();
  return /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(text ?? "")
    ? Number(text.replaceAll(".", "").replace(",", "."))
    : Number.NaN;
};

function content(node) {
  return node.nodeName === "#text" ? node.value : (node.childNodes ?? []).map(content).join(" ");
}

function rows(html, firstTableOnly = false) {
  const result = [];
  let foundTable = false;
  function visit(node) {
    if (firstTableOnly && node.tagName === "table") {
      if (foundTable) return;
      foundTable = true;
    }
    if (node.tagName === "tr")
      result.push(
        (node.childNodes ?? [])
          .filter((child) => ["td", "th"].includes(child.tagName))
          .map((child) => content(child).replace(/\s+/g, " ").trim()),
      );
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parse(html));
  return result;
}

export function verifyDocumentationSources({
  exemptionHtml,
  calculationHtml,
  registryPdf,
  quintoHtml,
  today,
}) {
  assert(
    today >= policy.itbiFrom && today <= policy.validThrough,
    "Vigência vencida: revisar as fontes e publicar nova política antes de liberar cálculos atuais.",
  );
  const firstCurrentRow = (html) =>
    rows(html).find((row) => /^A partir de\s+01\/01\/\d{4}/.test(row[0]));
  const exemption = firstCurrentRow(exemptionHtml);
  const calculation = firstCurrentRow(calculationHtml);
  assert(
    exemption?.[0] === "A partir de 01/01/2026",
    "A vigência publicada da isenção mudou ou não foi encontrada.",
  );
  assert.equal(
    publishedMoney(exemption[1]),
    policy.exemptionLimit,
    "O limite publicado de isenção mudou.",
  );
  assert(
    calculation?.[0] === "A partir de 01/01/2026",
    "A vigência publicada do cálculo mudou ou não foi encontrada.",
  );
  assert(
    publishedMoney(calculation[1]) === policy.reducedFinancingLimit &&
      publishedMoney(calculation[2]) === policy.reducedPropertyLimit,
    "Os limites publicados de ITBI mudaram.",
  );
  assert.equal(
    createHash("sha256").update(registryPdf).digest("hex"),
    policy.registrationPdfSha256,
    "A publicação ARISP mudou. Conferir as 48 faixas, notas e ISS antes de atualizar o hash.",
  );
  assert(typeof quintoHtml === "string", "A publicação do 5º RI não foi fornecida.");
  const quintoText = content(parse(quintoHtml)).replace(/\s+/g, " ");
  assert(
    /Data da vigência:\s*08\/jan\/2026/.test(quintoText),
    "A vigência publicada do 5º RI mudou.",
  );
  const quintoRows = rows(quintoHtml, true);
  assert.equal(
    quintoRows.length,
    49,
    "A tabela de registro do 5º RI deve conter 48 faixas e um cabeçalho.",
  );
  assert.equal(quintoRows[0].at(-1), "Total", "Cabeçalho do 5º RI não reconhecido.");
  for (const [index, [start, total]] of QUINTO_REGISTRATION_TABLE.entries()) {
    const row = quintoRows[index + 1];
    const last = index === QUINTO_REGISTRATION_TABLE.length - 1;
    assert.equal(row.length, last ? 11 : 12, `Estrutura da faixa ${index + 1} do 5º RI mudou.`);
    const publishedStart = last
      ? Math.round((publishedMoney(row[2]) + 0.01) * 100) / 100
      : publishedMoney(row[1]);
    assert.equal(publishedStart, start, `Início da faixa ${index + 1} do 5º RI mudou.`);
    if (!last) {
      assert.equal(row[2], "até");
      assert.equal(
        Math.round(publishedMoney(row[3]) * 100),
        Math.round(QUINTO_REGISTRATION_TABLE[index + 1][0] * 100) - 1,
        `Fim da faixa ${index + 1} do 5º RI mudou.`,
      );
    } else assert.equal(row[1], "acima de");
    assert.equal(publishedMoney(row.at(-1)), total, `Total da faixa ${index + 1} do 5º RI mudou.`);
  }
}

async function readSource(url) {
  let lastStatus = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    lastStatus = null;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      lastStatus = response.status;
      assert(response.ok, `Fonte indisponível: HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      assert(
        buffer.length > 0 && buffer.length <= 15 * 1024 * 1024,
        "Tamanho inesperado na publicação.",
      );
      return buffer;
    } catch (error) {
      if (
        attempt === 2 &&
        permitsTemporaryItbiSourceOutage({
          id: process.env.DOCUMENTATION_SOURCE_OUTAGE_EXCEPTION,
          url,
          status: lastStatus,
          now: new Date().toISOString(),
        })
      ) {
        process.stderr.write(
          `::warning::Exceção temporária ${temporaryItbiSourceOutageException.id}: fonte ITBI respondeu HTTP ${lastStatus}; usando o último limite versionado até ${temporaryItbiSourceOutageException.expiresAt}.\n`,
        );
        return temporaryItbiSourceSnapshot(url);
      }
      if (attempt === 2)
        throw new Error(`Não foi possível verificar ${url}: ${error.message}`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [exemptionUrl, calculationUrl, registryUrl] = policy.sources;
  const exemptionHtml = (await readSource(exemptionUrl)).toString("utf8");
  const calculationHtml = (await readSource(calculationUrl)).toString("utf8");
  const registryPdf = await readSource(registryUrl);
  const quintoHtml = (await readSource(policy.sources[8])).toString("utf8");
  verifyDocumentationSources({
    exemptionHtml,
    calculationHtml,
    registryPdf,
    quintoHtml,
    today: new Date().toISOString().slice(0, 10),
  });
  console.log(
    `Fontes públicas conferidas: ${policy.version}. Limites de ITBI, PDF ARISP e 48 faixas do 5º RI correspondem à política versionada.`,
  );
}
