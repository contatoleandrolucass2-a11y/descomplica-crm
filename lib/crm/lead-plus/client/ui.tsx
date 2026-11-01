import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Plus, Pencil, Trash2, Download } from "lucide-react";
export function Button({
  children,
  onClick,
  primary = false,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={"btn " + (primary ? "primary" : "")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Panel({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="legacy-panel">
      {title && (
        <div className="panel-title">
          {title}
          {actions}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}
export function Toggle({
  label,
  initial = true,
  onChange,
}: {
  label: string;
  initial?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [checked, setChecked] = useState(initial);
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      className={"switch " + (checked ? "on" : "")}
      onClick={() => {
        setChecked(!checked);
        onChange?.(!checked);
      }}
    >
      <span />
    </button>
  );
}
export function Field({
  label,
  value = "",
  type = "text",
  options,
}: {
  label: string;
  value?: string;
  type?: string;
  options?: string[];
}) {
  return (
    <label className="field">
      {label}
      {options ? (
        <select defaultValue={value || options[0]}>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea defaultValue={value} />
      ) : (
        <input type={type} defaultValue={value} />
      )}
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + className}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-title">
        {title}
        <button aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="legacy-tabs" role="tablist">
      {items.map((t) => (
        <button
          role="tab"
          aria-selected={t === value}
          className={t === value ? "active" : ""}
          key={t}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
export function downloadCSV(name: string, headers: string[], rows: string[][]) {
  const blob = new Blob(
    [
      "\ufeff" +
        [headers, ...rows]
          .map((r) =>
            r
              .map((v) => '"' + (/^[=+@\-\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"')
              .join(";"),
          )
          .join("\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty-table">Nenhum registro encontrado</div>}
    </div>
  );
}
export function RecordList({
  title,
  headers,
  initial,
  fields,
}: {
  title: string;
  headers: string[];
  initial: string[][];
  fields?: string[];
}) {
  const [rows, setRows] = useState(initial),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<number | null>(null),
    [deleting, setDeleting] = useState<number | null>(null),
    [notice, setNotice] = useState("");
  const filtered = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.join(" ").toLowerCase().includes(query.toLowerCase()));
  return (
    <Panel
      title={title}
      actions={
        <div className="pagination">
          <Button onClick={() => setPage(Math.max(1, page - 1))}>← Anterior</Button>
          <span>{page}</span>
          <Button
            onClick={() =>
              setPage(Math.min(Math.max(1, Math.ceil(filtered.length / 10)), page + 1))
            }
          >
            Próximo →
          </Button>
        </div>
      }
    >
      <div className="toolbar">
        <Button primary onClick={() => setEditing(-1)}>
          <Plus size={16} /> {title.includes("usuários") ? "Criar usuário" : "Novo"}
        </Button>
        {title.includes("usuários") && (
          <Button onClick={() => setNotice("Simulação local: convites preparados.")}>
            Reenviar todos os convites
          </Button>
        )}
      </div>
      <div className="toolbar">
        <select aria-label="Status">
          <option>Ativos</option>
          <option>Inativos</option>
          <option>Todos</option>
        </select>
        <select aria-label="Hierarquia">
          <option>Todas hierarquias</option>
          <option>Equipe comercial</option>
        </select>
        <input
          placeholder="Nome, usuário, e-mail ou telefone"
          aria-label="Buscar registros"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <Button
          onClick={() => {
            setQuery("");
            setPage(1);
          }}
        >
          Limpar
        </Button>
        <Button onClick={() => downloadCSV(title, headers, rows)}>
          <Download size={15} /> Exportar
        </Button>
      </div>
      {notice && <div className="notice">{notice}</div>}
      <DataTable
        headers={[...headers, ""]}
        rows={filtered.slice((page - 1) * 10, page * 10).map(({ r, i }) => [
          ...r,
          <div key={i} className="row-actions">
            <Button onClick={() => setEditing(i)}>
              <Pencil size={14} />
            </Button>
            <Button onClick={() => setDeleting(i)}>
              <Trash2 size={14} />
            </Button>
          </div>,
        ])}
      />
      <p className="table-summary">
        Mostrando {Math.min(1, filtered.length) + (page - 1) * 10} a{" "}
        {Math.min(page * 10, filtered.length)} de {filtered.length} registros
      </p>
      {editing !== null && (
        <Modal
          title={editing < 0 ? "Novo registro" : "Editar registro"}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const inputs = Array.from(
                e.currentTarget.querySelectorAll<HTMLInputElement>("input"),
              );
              const row = inputs.map((i) => i.value);
              setRows(editing < 0 ? [...rows, row] : rows.map((r, i) => (i === editing ? row : r)));
              setEditing(null);
              setNotice("Registro salvo nesta prévia local.");
            }}
          >
            {(fields || headers).map((h, i) => (
              <label className="field" key={h}>
                {h}
                <input
                  required={h === "Nome" || (!headers.includes("Nome") && i === 0)}
                  defaultValue={editing < 0 ? "" : rows[editing]?.[i] || ""}
                />
              </label>
            ))}
            <div className="modal-actions">
              <Button onClick={() => setEditing(null)}>Cancelar</Button>
              <Button primary type="submit">
                Salvar
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting !== null && (
        <Modal title="Excluir registro?" onClose={() => setDeleting(null)}>
          <p>Excluir este registro fictício da prévia local?</p>
          <div className="modal-actions">
            <Button onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button
              primary
              onClick={() => {
                setRows(rows.filter((_, i) => i !== deleting));
                setDeleting(null);
              }}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
