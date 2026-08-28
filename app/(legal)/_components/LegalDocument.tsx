import Link from "next/link";

import {
  getLegalDocument,
  LEGAL_DOCUMENT_LINKS,
  type LegalDocumentKey,
} from "@/lib/legal/documents";

export function LegalDocument({ documentKey }: { documentKey: LegalDocumentKey }) {
  const document = getLegalDocument(documentKey);
  const displayedLastUpdated = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${document.lastUpdated}T00:00:00Z`));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 sm:py-14">
      <article className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <header>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-800 underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
          >
            Voltar para o login
          </Link>
          <p className="mt-6 text-sm font-semibold tracking-wide text-cyan-800 uppercase">
            Documento legal
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {document.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">{document.summary}</p>
          <dl className="mt-6 grid gap-3 rounded-xl bg-slate-100 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-slate-950">Versão</dt>
              <dd className="mt-1 break-words text-slate-700">{document.version}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-950">Atualização</dt>
              <dd className="mt-1 text-slate-700">
                <time dateTime={document.lastUpdated}>{displayedLastUpdated}</time>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-950">Revisão</dt>
              <dd className="mt-1 text-amber-800" role="status">
                {document.review.label}
              </dd>
            </div>
          </dl>
        </header>

        <nav aria-label="Documentos legais" className="mt-8 border-y border-slate-200 py-4">
          <ul className="flex flex-wrap gap-x-5 gap-y-3">
            {LEGAL_DOCUMENT_LINKS.map((link) => (
              <li key={link.key}>
                <Link
                  href={link.href}
                  aria-current={link.key === documentKey ? "page" : undefined}
                  className="inline-flex min-h-11 items-center font-medium text-cyan-800 underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 space-y-10">
          {document.sections.map((section) => (
            <section key={section.id} aria-labelledby={`${document.key}-${section.id}`}>
              <h2
                id={`${document.key}-${section.id}`}
                className="text-xl font-semibold tracking-tight sm:text-2xl"
              >
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4 leading-7 text-slate-700">
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-slate-700">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-600">
          <p>
            Estado desta versão: {document.review.label.toLocaleLowerCase("pt-BR")}. Nenhuma razão
            social, identidade de controlador, DPO ou contato legal foi presumido.
          </p>
        </footer>
      </article>
    </main>
  );
}
