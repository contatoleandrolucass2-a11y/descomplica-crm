interface RoutePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function RoutePlaceholder({ eyebrow, title, description }: RoutePlaceholderProps) {
  return (
    <main className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium tracking-wide text-blue-700 uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">{description}</p>
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          Rota, autenticação e permissão já estão ativas. Os dados funcionais serão conectados na
          migração incremental do domínio.
        </div>
      </div>
    </main>
  );
}
