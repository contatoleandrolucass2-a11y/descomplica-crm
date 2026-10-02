const spelling = new Map([
  ["terreo", "t\u00e9rreo"],
  ["adaptavel", "adapt\u00e1vel"],
  ["nao", "n\u00e3o"],
  ["condominio", "condom\u00ednio"],
]);
const acronym = /^(?:\d+Q|HIS(?:-\d+)?|HMP|R2-?V|PCD|PNE|AP|QA|SP)$/;

export function formatTabelaoDescription(value) {
  const text = value?.trim().replace(/\s+/g, " ");
  if (!text) return "N\u00e3o informado";
  return text
    .replace(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu, (word) => {
      const upper = word.toLocaleUpperCase("pt-BR");
      if (acronym.test(upper)) return upper;
      const lower = word.toLocaleLowerCase("pt-BR");
      return spelling.get(lower) ?? lower;
    })
    .replace(/\bc\s*\/\s*(AP|s)\b/gu, (_, complement) => `C/${complement.toUpperCase()}`)
    .replace(
      /^(\P{L}*)(\p{L})/u,
      (_, prefix, letter) => prefix + letter.toLocaleUpperCase("pt-BR"),
    );
}

export function formatTabelaoPlant(value) {
  return formatTabelaoDescription(value).replace(/^(Tipo|T\u00e9rreo)\s+/u, "$1\n");
}
