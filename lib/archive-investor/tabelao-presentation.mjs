const spelling = new Map([
  ["tipo", "tipo"],
  ["terreo", "t\u00e9rreo"],
  ["t\u00e9rreo", "t\u00e9rreo"],
  ["adaptavel", "adapt\u00e1vel"],
  ["adapt\u00e1vel", "adapt\u00e1vel"],
  ["nao", "n\u00e3o"],
  ["n\u00e3o", "n\u00e3o"],
  ["condominio", "condom\u00ednio"],
  ["condom\u00ednio", "condom\u00ednio"],
  ["informado", "informado"],
  ["informada", "informada"],
  ["unidade", "unidade"],
  ["para", "para"],
  ["vaga", "vaga"],
  ["avulsa", "avulsa"],
  ["programa", "programa"],
  ["residencial", "residencial"],
  ["especial", "especial"],
]);
const acronym = /^(?:\d+Q|HIS(?:-\d+)?|HMP|R2-?V|PCD|PNE|AP|QA|SP)$/;

export function formatTabelaoDescription(value) {
  const text = value
    ?.trim()
    .replace(/\s+/g, (space, offset, source) =>
      source[offset - 1] === "/" || source[offset + space.length] === "/" ? space : " ",
    );
  if (!text) return "N\u00e3o informado";
  const firstLetter = text.search(/\p{L}/u);
  return text
    .replace(/(?:R2-V|HIS-\d+)(?![\p{L}\p{N}])|[\p{L}\p{N}]+/giu, (word, offset) => {
      const upper = word.toLocaleUpperCase("pt-BR");
      if (acronym.test(upper)) return upper;
      const common = spelling.get(word.toLocaleLowerCase("pt-BR"));
      if (!common) return word;
      return offset === firstLetter
        ? common[0].toLocaleUpperCase("pt-BR") + common.slice(1)
        : common;
    })
    .replace(
      /\bc(\s*\/\s*)(AP|s)\b/giu,
      (_, separator, complement) => `C${separator}${complement.toUpperCase()}`,
    );
}

export function formatTabelaoPlant(value) {
  return formatTabelaoDescription(value).replace(/^(Tipo|T\u00e9rreo)\s+/u, "$1\n");
}
