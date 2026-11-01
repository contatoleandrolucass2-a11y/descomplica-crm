import { normalizePhone } from "./integrations.mjs";
export const spreadsheetColumns = [
  "Nome",
  "E-mail",
  "Telefone",
  "Produto de interesse",
  "Valor do produto",
  "Data de criação",
  "Usuário",
  "Mensagem do cliente",
  "Código/Referência",
  "Origem",
];
export function spreadsheetRow(row, { users, ownerId, canAssign, actorId, index }) {
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 422 });
  };
  const [
    name = "",
    email = "",
    originalPhone = "",
    product = "",
    price = "",
    date = "",
    ownerName = "",
    message = "",
    reference = "",
    source = "",
  ] = row.map((value) => String(value).trim());
  if (!name || name.length > 160) fail("Informe o nome do lead, com até 160 caracteres.");
  if (!email && !originalPhone) fail("Informe e-mail ou telefone.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("E-mail inválido.");
  const phone = normalizePhone(originalPhone);
  if (originalPhone && !phone) fail("Telefone inválido.");
  let owner = ownerId || undefined;
  if (ownerName) {
    const matches = users.filter((user) => user.active && user.name === ownerName);
    if (matches.length !== 1)
      fail("Usuário da coluna G não encontrado, inativo ou ambíguo no seu acesso.");
    owner = matches[0].id;
  }
  if (!canAssign && owner && owner !== actorId)
    fail("Você só pode importar leads para seu próprio usuário.");
  if (!canAssign) owner = actorId;
  if (owner && !users.some((user) => user.id === owner && user.active))
    fail("Usuário responsável inválido ou fora do seu acesso.");
  let value = 0;
  if (price) {
    const clean = price.replace(/R\$|\s/g, "");
    value = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean);
    if (!Number.isFinite(value) || value < 0 || value > 1e12) fail("Valor do produto inválido.");
  }
  let createdAt;
  if (date) {
    const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    if (!parts) fail("Data de criação deve seguir dd/mm/aaaa.");
    const iso = parts[3] + "-" + parts[2] + "-" + parts[1];
    const parsed = new Date(iso + "T03:00:00Z");
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== iso)
      fail("Data de criação inexistente.");
    if (+parsed > Date.now()) fail("Data de criação não pode estar no futuro.");
    createdAt = parsed.toISOString();
  }
  const extra = row.slice(10).map(String).filter(Boolean);
  const fullMessage = [message, ...extra].filter(Boolean).join("\n");
  if (
    fullMessage.length > 2000 ||
    product.length > 250 ||
    source.length > 250 ||
    reference.length > 250
  )
    fail("Produto, origem ou referência excede 250 caracteres, ou mensagem excede 2000.");
  return {
    input: {
      name,
      email: email.toLowerCase(),
      phone,
      product: product || "Não informado",
      source:
        {
          facebook: "facebook",
          instagram: "instagram",
          planilha: "csv",
          "cadastro manual": "manual",
        }[source.toLocaleLowerCase("pt-BR")] ||
        source ||
        "csv",
      owner_id: owner,
      message: fullMessage,
      attribution: { product_reference: reference, delivery_connector: "spreadsheet" },
    },
    value,
    createdAt,
  };
}
