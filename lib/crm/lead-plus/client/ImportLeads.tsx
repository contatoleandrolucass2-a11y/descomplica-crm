import { useState } from "react";
import { api, useApi, type User } from "./api";
import { useAuth } from "./Auth";
import { Button, DataTable, Panel, downloadCSV } from "./ui";

export function parseCSV(raw: string): string[][] {
  const source = raw.replace(/^\uFEFF/, "");
  const delimiter = (source.split(/\r?\n/, 1)[0] || "").includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw Error("O CSV contém aspas não fechadas.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

type ImportOutcome = {
  line: number;
  name: string;
  status: string;
  error?: string;
  created?: boolean;
};
type ImportJob = {
  id: string;
  filename: string;
  actor_name: string;
  created_at: string;
  updated_at: string;
  status: string;
  deleted?: boolean;
  outcomes: ImportOutcome[];
  rows?: string[][];
};
const columns = [
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
export default function ImportLeads() {
  const auth = useAuth();
  const users = useApi<{ data: User[] }>("/resources/users");
  const history = useApi<{ data: ImportJob[] }>("/imports");
  const [file, setFile] = useState<File | null>(null),
    [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true),
    [archived, setArchived] = useState(false),
    [assignment, setAssignment] = useState("automatic"),
    [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false),
    [failure, setFailure] = useState(""),
    [selected, setSelected] = useState<ImportJob | null>(null);
  const records = hasHeader ? rows.slice(1) : rows;
  const canAssign = auth.can("crm.settings.manage") || auth.can("leads.edit.scope");
  const download = async (job: ImportJob) => {
    try {
      const full = await api<ImportJob>("/imports/" + job.id);
      downloadCSV(job.filename.replace(/\.[^.]+$/, "") + "-importacao", [], full.rows || []);
    } catch (error) {
      setFailure((error as Error).message);
    }
  };
  return (
    <div className="system-screen spreadsheet-import">
      <Panel title="Importação de leads através de uma planilha">
        <p>
          Para que os leads sejam importados corretamente, sua planilha deve seguir o seguinte
          padrão:
        </p>
        <ul className="sheet-instructions">
          <li>
            Coluna A: Nome do lead <strong>(Obrigatório)</strong>
          </li>
          <li>
            Coluna B: E-mail do lead <strong>(Obrigatório se não fornecer telefone)</strong>
          </li>
          <li>
            Coluna C: Telefone do lead <strong>(Obrigatório se não fornecer e-mail)</strong>
          </li>
          <li>
            Coluna D: Produto de interesse <strong>(Exemplo: “Apartamento XYZ”)</strong> — Esse
            campo é utilizado nas mensagens prontas
          </li>
          <li>
            Coluna E: Valor do produto <strong>(Opcional)</strong>
          </li>
          <li>
            Coluna F: Data de criação (dia/mês/ano com 4 dígitos — dd/mm/aaaa){" "}
            <strong>(Opcional: se não fornecida, os leads entrarão com a data de hoje)</strong>
          </li>
          <li>
            Coluna G: Nome do usuário que deve receber esse lead exatamente como está cadastrado no
            DESCOMPLICA LEAD <strong>(Opcional)</strong>
          </li>
          <li>
            Coluna H: Mensagem do cliente <strong>(Opcional)</strong>
          </li>
          <li>
            Coluna I: Código/Referência do produto <strong>(Opcional)</strong>
          </li>
          <li>
            Coluna J: Nome do portal/site/sistema que originou esse lead <strong>(Opcional)</strong>
          </li>
        </ul>
        <p>
          <strong>
            Todas as outras colunas de sua planilha serão importadas dentro do campo “Mensagem do
            cliente”.
          </strong>
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || reading || !file) return;
            setFailure("");
            if (!records.length || records.length > 500) {
              setFailure("O arquivo deve conter entre 1 e 500 leads.");
              return;
            }
            if (canAssign && assignment === "user" && !owner) {
              setFailure("Selecione o usuário que deve receber os leads.");
              return;
            }
            setBusy(true);
            try {
              const job = await api<ImportJob>("/imports", "POST", {
                filename: file.name,
                rows,
                has_header: hasHeader,
                archived,
                owner_id: canAssign && assignment === "user" ? owner : "",
              });
              setSelected(job);
              await history.refresh();
            } catch (error) {
              setFailure((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy || reading} className="sheet-form">
            <div className="sheet-field">
              <label htmlFor="spreadsheet-file">
                <b>* Planilha</b>
              </label>
              <p>
                Restrito a arquivos .xls, .xlsx e .csv. O arquivo também não pode ser maior que 5
                MB.
              </p>
              <Button onClick={() => downloadCSV("modelo-descomplica-lead", columns, [])}>
                Baixar planilha de exemplo
              </Button>
              <input
                id="spreadsheet-file"
                aria-label="Planilha"
                type="file"
                accept=".xls,.xlsx,.csv"
                required
                onChange={async (event) => {
                  setFailure("");
                  setSelected(null);
                  setFile(null);
                  setRows([]);
                  const candidate = event.target.files?.[0];
                  if (!candidate) return;
                  if (
                    candidate.size > 5 * 1024 * 1024 ||
                    !/\.(xls|xlsx|csv)$/i.test(candidate.name)
                  ) {
                    setFailure("Selecione um arquivo .xls, .xlsx ou .csv de até 5 MB.");
                    return;
                  }
                  setReading(true);
                  try {
                    let parsed: string[][];
                    if (/\.csv$/i.test(candidate.name)) parsed = parseCSV(await candidate.text());
                    else {
                      const XLSX = await import("xlsx");
                      const workbook = XLSX.read(await candidate.arrayBuffer(), {
                        type: "array",
                        cellDates: true,
                        sheetRows: 502,
                        sheets: 0,
                      });
                      const sheet = workbook.Sheets[workbook.SheetNames[0] || ""];
                      if (!sheet) throw Error("A planilha não contém uma aba legível.");
                      for (const key of Object.keys(sheet))
                        if (!key.startsWith("!") && sheet[key].t === "d") {
                          const date = new Date(sheet[key].v);
                          sheet[key] = {
                            t: "s",
                            v:
                              String(date.getUTCDate()).padStart(2, "0") +
                              "/" +
                              String(date.getUTCMonth() + 1).padStart(2, "0") +
                              "/" +
                              date.getUTCFullYear(),
                          };
                        }
                      parsed = XLSX.utils
                        .sheet_to_json<
                          string[]
                        >(sheet, { header: 1, raw: false, defval: "", blankrows: false })
                        .map((row) => row.map((value) => String(value)));
                    }
                    if (
                      !parsed.length ||
                      parsed.length > 501 ||
                      parsed.some((row) => row.length > 50)
                    )
                      throw Error("A planilha deve conter até 500 leads e 50 colunas.");
                    setRows(parsed);
                    setFile(candidate);
                  } catch (error) {
                    setFailure((error as Error).message);
                  } finally {
                    setReading(false);
                  }
                }}
              />
            </div>
            <div className="sheet-field">
              <b>* Minha planilha tem cabeçalho?</b>
              <p>Na linha 1 está escrito “Nome”, “E-mail”, etc.?</p>
              <div className="sheet-radio-row">
                <label>
                  <input
                    type="radio"
                    name="header"
                    checked={hasHeader}
                    onChange={() => setHasHeader(true)}
                  />
                  Sim
                </label>
                <label>
                  <input
                    type="radio"
                    name="header"
                    checked={!hasHeader}
                    onChange={() => setHasHeader(false)}
                  />
                  Não
                </label>
              </div>
            </div>
            <div className="sheet-field">
              <b>* Status do lead</b>
              <p>Os leads dessa planilha devem ser importados como...</p>
              <div className="sheet-radio-row">
                <label>
                  <input
                    type="radio"
                    name="status"
                    checked={!archived}
                    onChange={() => setArchived(false)}
                  />
                  Novos
                </label>
                <label>
                  <input
                    type="radio"
                    name="status"
                    checked={archived}
                    onChange={() => setArchived(true)}
                  />
                  Arquivados
                </label>
              </div>
            </div>
            <div className="sheet-field">
              <b>* Usuário</b>
              <p>Quando os leads não estão atrelados a um usuário...</p>
              {canAssign ? (
                <>
                  <label className="sheet-radio-option">
                    <input
                      type="radio"
                      name="assignment"
                      checked={assignment === "automatic"}
                      onChange={() => setAssignment("automatic")}
                    />
                    Seguir critérios de distribuição automática
                  </label>
                  <label className="sheet-radio-option">
                    <input
                      type="radio"
                      name="assignment"
                      checked={assignment === "user"}
                      onChange={() => setAssignment("user")}
                    />
                    Enviar para
                  </label>
                  <select
                    aria-label="Usuário destinatário"
                    disabled={assignment !== "user"}
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                  >
                    <option value="">Selecione um usuário...</option>
                    {users.data?.data
                      .filter((user) => user.active)
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                  </select>
                </>
              ) : (
                <p>
                  Enviar para meu usuário: <strong>{auth.user?.name}</strong>
                </p>
              )}
            </div>
            {file && (
              <details className="sheet-preview">
                <summary>{records.length} leads no arquivo · conferir prévia</summary>
                <DataTable
                  headers={columns}
                  rows={records
                    .slice(0, 5)
                    .map((row) => columns.map((_, index) => row[index] || ""))}
                />
              </details>
            )}
            <Button primary type="submit" disabled={!file || busy || reading}>
              {busy ? "Importando leads…" : reading ? "Lendo planilha…" : "Importar leads"}
            </Button>
          </fieldset>
        </form>
        {(failure || history.error || users.error) && (
          <p role="alert" className="api-error">
            {failure || history.error || users.error}
          </p>
        )}
        {selected && (
          <div className="sheet-results" role="status">
            <strong>
              {selected.status}: {selected.outcomes.filter((row) => row.status !== "Erro").length}{" "}
              de {selected.outcomes.length} linhas confirmadas.
            </strong>
            <DataTable
              headers={["Linha", "Nome", "Resultado"]}
              rows={selected.outcomes.map((row) => [row.line, row.name, row.error || row.status])}
            />
          </div>
        )}
      </Panel>
      <Panel title="Histórico de importações (máximo de 20 registros)">
        {history.loading ? (
          <p>Carregando histórico…</p>
        ) : (
          <DataTable
            headers={[
              "#",
              "Status",
              "Solicitado por",
              "Criado em",
              "Última atualização",
              "Progresso",
              "Ações",
            ]}
            rows={(history.data?.data || []).map((job) => [
              job.id.slice(0, 8),
              job.status,
              job.actor_name,
              new Date(job.created_at).toLocaleString("pt-BR"),
              new Date(job.updated_at).toLocaleString("pt-BR"),
              job.deleted ? "0%" : "100%",
              <div key={job.id} className="sheet-actions">
                <Button onClick={() => void download(job)}>Baixar o arquivo</Button>
                <Button onClick={() => setSelected(job)}>Ver resultado</Button>
                {!job.deleted && job.outcomes.some((row) => row.created) && (
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !confirm(
                          "Apagar os leads criados por esta importação? Esta ação não pode ser desfeita. Leads já existentes não serão apagados.",
                        )
                      )
                        return;
                      setBusy(true);
                      try {
                        await api("/imports/" + job.id + "/leads", "DELETE");
                        setSelected(null);
                        await history.refresh();
                        setFailure("");
                      } catch (error) {
                        setFailure((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Apagar leads
                  </Button>
                )}
              </div>,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
