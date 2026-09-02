export const INVESTOR_REGIONS = [
  "Centro",
  "Zona Norte",
  "Zona Leste",
  "Zona Sul",
  "Zona Oeste",
  "Outros",
];

const DISTRICTS_BY_REGION = {
  Centro: [
    "Bela Vista", "Bom Retiro", "Cambuci", "Consolação", "Liberdade", "República", "Santa Cecília", "Sé",
  ],
  "Zona Leste": [
    "Aricanduva", "Carrão", "Vila Formosa", "Cidade Tiradentes", "Ermelino Matarazzo", "Ponte Rasa", "Guaianases", "Lajeado",
    "Itaim Paulista", "Vila Curuçá", "Cidade Líder", "Itaquera", "José Bonifácio", "Parque do Carmo", "Água Rasa", "Belém",
    "Brás", "Mooca", "Pari", "Tatuapé", "Artur Alvim", "Cangaíba", "Penha", "Vila Matilde", "Iguatemi", "São Mateus",
    "São Rafael", "Jardim Helena", "São Miguel", "Vila Jacuí", "Sapopemba", "São Lucas", "Vila Prudente",
  ],
  "Zona Norte": [
    "Cachoeirinha", "Casa Verde", "Limão", "Brasilândia", "Freguesia do Ó", "Jaçanã", "Tremembé", "Anhanguera", "Perus",
    "Jaraguá", "Pirituba", "São Domingos", "Mandaqui", "Santana", "Tucuruvi", "Vila Guilherme", "Vila Maria", "Vila Medeiros",
  ],
  "Zona Oeste": [
    "Butantã", "Morumbi", "Raposo Tavares", "Rio Pequeno", "Vila Sônia", "Barra Funda", "Jaguara", "Jaguaré", "Lapa", "Perdizes",
    "Vila Leopoldina", "Alto de Pinheiros", "Itaim Bibi", "Jardim Paulista", "Pinheiros",
  ],
  "Zona Sul": [
    "Campo Limpo", "Capão Redondo", "Vila Andrade", "Cidade Dutra", "Grajaú", "Socorro", "Cidade Ademar", "Pedreira", "Cursino",
    "Ipiranga", "Sacomã", "Jabaquara", "Jardim Ângela", "Jardim São Luís", "Marsilac", "Parelheiros", "Campo Belo", "Campo Grande",
    "Santo Amaro", "Moema", "Saúde", "Vila Mariana",
  ],
};

const DISTRICT_ALIASES = {
  "Parque Industrial Tomas Edson": "Zona Oeste",
  "Jardim das Graças": "Zona Norte",
  "Jardim Santa Emília": "Zona Sul",
  "Vila Liviero": "Zona Sul",
  Brooklin: "Zona Sul",
  "Brooklin Paulista": "Zona Sul",
  "Jardim das Acácias": "Zona Sul",
  "Vila Olímpia": "Zona Oeste",
  "Vila Anastácio": "Zona Oeste",
  "Jardim Rosa Maria": "Zona Oeste",
  "Jardim Gilda Maria": "Zona Oeste",
  "Jardim das Esmeraldas": "Zona Oeste",
  "Jardim Miragaia": "Zona Leste",
  "Vila Carolina": "Zona Leste",
};

const EXACT_POSTAL_CODE_REGIONS = {
  "01141010": "Zona Oeste",
  "01144000": "Zona Oeste",
  "01306010": "Centro",
  "01507020": "Centro",
  "01519000": "Centro",
  "02713000": "Zona Norte",
  "04184020": "Zona Sul",
  "04186100": "Zona Sul",
  "04546045": "Zona Oeste",
  "04550000": "Zona Oeste",
  "04601001": "Zona Sul",
  "04662020": "Zona Sul",
  "04703020": "Zona Sul",
  "04766001": "Zona Sul",
  "05013000": "Zona Oeste",
  "05093000": "Zona Oeste",
  "05421001": "Zona Oeste",
  "05427020": "Zona Oeste",
  "05547030": "Zona Oeste",
  "05550050": "Zona Oeste",
  "08040115": "Zona Leste",
  "08115100": "Zona Leste",
};

function normalizeLocationName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

const EXPLICIT_REGION_ALIASES = new Map([
  ["centro", "Centro"],
  ["zona central", "Centro"],
  ["norte", "Zona Norte"],
  ["zona norte", "Zona Norte"],
  ["leste", "Zona Leste"],
  ["zona leste", "Zona Leste"],
  ["sul", "Zona Sul"],
  ["zona sul", "Zona Sul"],
  ["oeste", "Zona Oeste"],
  ["zona oeste", "Zona Oeste"],
  ["outro", "Outros"],
  ["outros", "Outros"],
]);

const DISTRICT_REGIONS = new Map();
for (const [region, districts] of Object.entries(DISTRICTS_BY_REGION)) {
  for (const district of districts) DISTRICT_REGIONS.set(normalizeLocationName(district), region);
}
for (const [district, region] of Object.entries(DISTRICT_ALIASES)) {
  DISTRICT_REGIONS.set(normalizeLocationName(district), region);
}

export function normalizePostalCode(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const normalized = digits.length === 7 ? digits.padStart(8, "0") : digits;
  return normalized.length === 8 ? normalized : null;
}

export function investorRegionFromPostalCode(value) {
  const postalCode = normalizePostalCode(value);
  return postalCode ? EXACT_POSTAL_CODE_REGIONS[postalCode] ?? "Outros" : "Outros";
}

export function resolveInvestorRegion(item = {}) {
  const explicitRegionValue = [item.region, item.regiao].find((value) => normalizeLocationName(value) !== "");
  const explicitRegion = EXPLICIT_REGION_ALIASES.get(normalizeLocationName(explicitRegionValue));
  if (explicitRegion) return explicitRegion;

  const district = [item.district, item.distrito, item.neighborhood, item.bairro]
    .find((value) => normalizeLocationName(value) !== "");
  const districtRegion = DISTRICT_REGIONS.get(normalizeLocationName(district));
  if (districtRegion) return districtRegion;

  const postalCode = [item.postalCode, item.cep].find((value) => normalizePostalCode(value));
  return investorRegionFromPostalCode(postalCode);
}
