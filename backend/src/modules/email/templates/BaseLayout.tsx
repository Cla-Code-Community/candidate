import * as React from "react";

interface BaseLayoutProps {
  previewText?: string;
  children: React.ReactNode;
}

/**
 * Estrutura HTML base compartilhada pelos e-mails transacionais.
 * Mantém estilos inline para compatibilidade com clientes de e-mail.
 */
export function BaseLayout({ children }: BaseLayoutProps) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body
        style={{
          margin: 0,
          padding: "24px",
          backgroundColor: "#f4f4f5",
          fontFamily: "Arial, Helvetica, sans-serif",
          color: "#18181b",
        }}
      >
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ maxWidth: "600px", margin: "0 auto" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  padding: "32px",
                }}
              >
                {children}
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
