import * as React from "react";
import { BaseLayout } from "./BaseLayout";

export interface WelcomeProps {
  name: string;
  appUrl: string;
}

/**
 * E-mail de boas-vindas enviado após o registro. Contém o nome do usuário
 * e um botão "Acessar plataforma" apontando para o frontend (EMAIL-07).
 */
export function Welcome({ name, appUrl }: WelcomeProps) {
  return (
    <BaseLayout previewText="Bem-vindo ao Candidate">
      <h1 style={{ fontSize: "22px", margin: "0 0 16px" }}>
        Bem-vindo, {name}!
      </h1>
      <p style={{ fontSize: "15px", lineHeight: "24px", margin: "0 0 24px" }}>
        Sua conta no Candidate foi criada com sucesso. Agora você pode
        acompanhar vagas, salvar oportunidades e organizar sua busca por emprego.
      </p>
      <a
        href={appUrl}
        style={{
          display: "inline-block",
          backgroundColor: "#2563eb",
          color: "#ffffff",
          textDecoration: "none",
          padding: "12px 24px",
          borderRadius: "6px",
          fontSize: "15px",
          fontWeight: "bold",
        }}
      >
        Acessar plataforma
      </a>
    </BaseLayout>
  );
}
