import { ExternalLink, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

type LegalDocumentPageProps = {
  title: string;
  description: string;
  documentUrl: string;
};

export function LegalDocumentPage({
  title,
  description,
  documentUrl,
}: LegalDocumentPageProps) {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-background dark:text-white">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-6 md:px-12">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/"
              className="mb-4 inline-flex text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Voltar para o início
            </Link>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
                <FileText aria-hidden="true" size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
          >
            Abrir PDF em nova aba
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        </div>

        <section
          aria-label={`Documento: ${title}`}
          className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-xl dark:border-white/10 dark:bg-neutral-900"
        >
          <object
            data={documentUrl}
            type="application/pdf"
            className="h-[70vh] min-h-[520px] w-full md:h-[78vh]"
            aria-label={`Visualização do documento: ${title}`}
          >
            <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 px-6 text-center">
              <FileText aria-hidden="true" size={40} />
              <p className="max-w-md text-neutral-600 dark:text-neutral-300">
                Seu navegador não conseguiu exibir o documento nesta página.
              </p>
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 underline underline-offset-4 dark:text-blue-400"
              >
                Abra o documento em uma nova aba
              </a>
            </div>
          </object>
        </section>
      </main>

      <Footer />
    </div>
  );
}
