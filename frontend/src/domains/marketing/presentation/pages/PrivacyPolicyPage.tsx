import { LegalDocumentPage } from "@/domains/marketing/presentation/components/LegalDocumentPage";

const privacyPolicyUrl = "/politica-de-privacidade-candidate.pdf";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      title="Política de Privacidade"
      description="Consulte como o Cand!Date! trata e protege seus dados."
      documentUrl={privacyPolicyUrl}
    />
  );
}
