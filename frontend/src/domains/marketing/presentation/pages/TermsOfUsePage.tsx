import { LegalDocumentPage } from "@/domains/marketing/presentation/components/LegalDocumentPage";

const termsOfUseUrl = "/termos-de-uso-candidate.pdf";

export default function TermsOfUsePage() {
  return (
    <LegalDocumentPage
      title="Termos de Uso"
      description="Consulte as regras e condições de uso do Cand!Date!."
      documentUrl={termsOfUseUrl}
    />
  );
}
