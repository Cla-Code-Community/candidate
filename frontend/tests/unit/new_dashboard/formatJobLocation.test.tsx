import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { formatJobLocation } from "@/features/jobs/utils/formatJobLocation";
import { JobLocation } from "@/features/jobs/components/JobLocation";

describe("formatJobLocation", () => {
  it.each([
    ["São Paulo, SP, São Paulo, São Paulo, Brasil", "São Paulo, SP, Brasil"],
    ["Austin, Texas, United States | Austin, TX", "Austin, TX, EUA"],
    ["New York, NY | New York, New York, United States", "New York, NY, EUA"],
    ["Remote, Brazil | Campinas, São Paulo, Brazil", "Campinas, SP, Brasil"],
    ["Remote USA", "EUA"],
    ["Remote India | Pune, India", "Pune, Índia"],
    ["Remoto, Brasil | Campinas, SP, Brasil", "Campinas, SP, Brasil"],
    ["São Paulo, Brasil, Brazil", "São Paulo, Brasil"],
    ["Austin, TX, U.S.A. | Austin, Texas, Estados Unidos", "Austin, TX, EUA"],
    ["", "Localização não informada"],
    ["Local não informado", "Localização não informada"],
    ["Remote", "Localização não informada"],
    ["CA", "CA"],
    ["Georgia", "Georgia"],
  ])("formata %s sem inferir dados", (input, primary) => {
    expect(formatJobLocation(input)).toEqual({ primary, additional: [] });
  });
  it("deduplica localidades com país estruturado e preserva locais distintos", () => {
    expect(
      formatJobLocation(
        "Los Angeles, California; Novato, California; Los Angeles, California",
        { country: "United States" },
      ),
    ).toEqual({
      primary: "Los Angeles, CA, EUA",
      additional: ["Novato, CA, EUA"],
    });
    expect(
      formatJobLocation("Los Angeles, California; Novato, California"),
    ).toEqual({
      primary: "Los Angeles, California",
      additional: ["Novato, California"],
    });
  });
  it("preserva ambiguidades, cidades homônimas e separadores variados", () => {
    expect(
      formatJobLocation(
        "Springfield, Illinois, USA / Springfield, Massachusetts, USA\nParis, France",
      ),
    ).toEqual({
      primary: "Springfield, IL, EUA",
      additional: ["Springfield, MA, EUA", "Paris, França"],
    });
  });
  it("prioriza campos estruturados equivalentes sem mutar os originais", () => {
    const payload = Object.freeze({
      city: "Austin",
      state: "Texas",
      country: "United States",
    });
    const original = "austin, TX, USA";
    expect(formatJobLocation(original, payload)).toEqual({
      primary: "Austin, TX, EUA",
      additional: [],
    });
    expect(payload).toEqual({
      city: "Austin",
      state: "Texas",
      country: "United States",
    });
    expect(original).toBe("austin, TX, USA");
    expect(formatJobLocation(undefined)).toEqual({
      primary: "Localização não informada",
      additional: [],
    });
  });
  it("não substitui uma localidade distinta pelos campos estruturados", () => {
    expect(
      formatJobLocation("Austin, Texas, USA", {
        city: "Paris",
        country: "France",
      }),
    ).toEqual({ primary: "Austin, TX, EUA", additional: ["Paris, França"] });
  });
  it.each([
    ["New York, New York, United States | New York, NY", "New York, NY, EUA"],
    ["Austin, Texas, United States | Austin, TX", "Austin, TX, EUA"],
    [
      "São Paulo, São Paulo, Brasil | São Paulo, SP, Brasil",
      "São Paulo, SP, Brasil",
    ],
    ["Remote USA | New York, NY, USA", "New York, NY, EUA"],
    ["Austin, Texas | Austin, TX", "Austin, TX"],
    ["Austin, TX | Austin, Texas", "Austin, TX"],
  ])("unifica a identidade geográfica de %s", (value, primary) => {
    expect(formatJobLocation(value)).toEqual({ primary, additional: [] });
  });
  it("não conta estado estruturado equivalente como uma nova localidade", () => {
    expect(
      formatJobLocation("New York, NY", {
        state: "New York",
        country: "United States",
      }),
    ).toEqual({ primary: "New York, NY, EUA", additional: [] });
    expect(formatJobLocation("New York, NY", { state: "New York" })).toEqual({
      primary: "New York, NY",
      additional: [],
    });
    expect(
      formatJobLocation("New York, NY", {
        city: "New York",
        state: "New York",
      }),
    ).toEqual({ primary: "New York, NY", additional: [] });
  });
  it.each([
    ["New York, NY | Boston, MA", "New York, NY", "Boston, MA"],
    ["Washington, DC | Arlington, VA", "Washington, DC", "Arlington, VA"],
    ["Austin, TX | Dallas, TX", "Austin, TX", "Dallas, TX"],
    ["Portland, OR | Portland, ME", "Portland, OR", "Portland, ME"],
  ])("preserva localidades distintas em %s", (value, primary, additional) => {
    expect(formatJobLocation(value)).toEqual({
      primary,
      additional: [additional],
    });
  });
  it("omite +N para equivalências e mantém +1 para cidades distintas", () => {
    const view = render(
      <JobLocation
        location="New York, NY"
        structured={{ state: "New York", country: "United States" }}
      />,
    );
    expect(screen.getByText("New York, NY, EUA")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Consultar/ }),
    ).not.toBeInTheDocument();
    view.rerender(<JobLocation location="New York, NY | Boston, MA" />);
    expect(screen.getByRole("button", { name: /Consultar/ })).toHaveTextContent(
      "+1 local",
    );
  });
  it("permite consultar e fechar as localidades adicionais", () => {
    render(<JobLocation location="Lisboa, Portugal | Porto, Portugal" />);
    expect(screen.getByText("Lisboa, Portugal")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Consultar 1 localidades adicionais",
      }),
    );
    expect(
      within(
        screen.getByRole("dialog", { name: "Localidades adicionais" }),
      ).getByText("Porto, Portugal"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar localidades" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
