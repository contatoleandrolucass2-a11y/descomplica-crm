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

export function formatTabelaoAddress(item) {
  return [item.street, item.streetNumber, item.neighborhood]
    .map((value) => value?.trim() || "N\u00e3o informado")
    .join(" / ");
}

function mapsAddressPart(value) {
  const text = value?.trim();
  return text && !/^n[a\u00e3]o informad[oa]$/iu.test(text) ? text : null;
}

export function buildTabelaoMapsUrl(item) {
  const street = mapsAddressPart(item.street);
  if (!street) return null;

  const query = [
    street,
    item.streetNumber,
    item.neighborhood,
    item.city,
    item.state,
    item.postalCode,
  ]
    .map(mapsAddressPart)
    .filter(Boolean)
    .join(", ");
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({ api: "1", query }).toString();
  return url.toString();
}
