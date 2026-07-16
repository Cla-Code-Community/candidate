import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobsProvider, useJobsContext } from "@/domains/new_dashboard/context/JobsContext";
import { ToastProvider } from "@/domains/new_dashboard/context/ToastContext";

function JobsConsumer() {
  const { jobs, addNewJob, updateJobStatus, updateJobNotes } = useJobsContext();

  return (
    <div>
      <p data-testid="jobs-count">{jobs.length}</p>
      <p data-testid="first-title">{jobs[0]?.jobTitle}</p>
      <p data-testid="first-status">{jobs[0]?.status}</p>
      <p data-testid="first-notes">{jobs[0]?.notes}</p>
      <button
        type="button"
        onClick={() =>
          addNewJob({
            jobTitle: "Nova vaga",
            company: "ACME",
            location: "Remoto",
            salary: "A combinar",
            type: "Remoto",
            level: "Pleno",
            tags: "React",
            source: "LinkedIn",
            jobLink: "https://example.com/nova",
            notes: "",
          })
        }
      >
        Adicionar
      </button>
      <button
        type="button"
        onClick={() => updateJobStatus(jobs[0].id, "applied")}
      >
        Mudar status
      </button>
      <button
        type="button"
        onClick={() => updateJobNotes(jobs[0].id, "Nota inicial")}
      >
        Mudar notas
      </button>
    </div>
  );
}

describe("JobsContext", () => {
  it("adiciona vaga e atualiza status/notas", () => {
    render(
      <ToastProvider>
        <JobsProvider>
          <JobsConsumer />
        </JobsProvider>
      </ToastProvider>,
    );

    const initialCount = Number(screen.getByTestId("jobs-count").textContent);
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(Number(screen.getByTestId("jobs-count").textContent)).toBe(
      initialCount + 1,
    );
    expect(screen.getByTestId("first-title")).toHaveTextContent("Nova vaga");

    fireEvent.click(screen.getByRole("button", { name: /mudar status/i }));
    expect(screen.getByTestId("first-status")).toHaveTextContent("applied");
    fireEvent.click(screen.getByRole("button", { name: /mudar notas/i }));
    expect(screen.getByTestId("first-notes")).toHaveTextContent("Nota inicial");
  });
});
