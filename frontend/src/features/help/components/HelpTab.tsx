export function HelpTab() {
  const faqs = [
    {
      question: "Como o Match Score das vagas é calculado?",
      answer:
        "Nosso sistema compara as tecnologias do seu perfil com os requisitos técnicos descritos por cada empresa para gerar uma porcentagem de compatibilidade.",
    },
    {
      question: "O que é a agenda disponível dos mentores?",
      answer:
        "Os horários disponíveis são sincronizados com a agenda interna de cada mentor. Você pode marcar um bate-papo técnico sem custo de forma simulada.",
    },
    {
      question: "Como posso mudar o meu status de candidatura?",
      answer:
        "Você pode clicar na aba 'Dashboard' e mover as vagas para acompanhar em tempo real se foi contratado ou selecionado para entrevistas.",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-6 py-8 lg:px-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-[18px] font-bold">Perguntas Frequentes & Central de Ajuda</h2>
        <p className="mt-5 text-sm text-muted-foreground">
          Encontre dicas rápidas sobre como alavancar o uso do seu painel profissional.
        </p>
        <div className="mt-4 space-y-3">
          {faqs.map((faq) => (
            <article key={faq.question} className="rounded-lg border border-border bg-background px-4 py-4">
              <h3 className="text-sm font-bold">{faq.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {faq.answer}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
