import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { NotificationProvider } from "../src/components/notifications/NotificationProvider";
import { ThemeProvider } from "../src/components/Providers/ThemeProvider";

type RenderWithProvidersOptions = RenderOptions & {
  route?: string;
  withNotifications?: boolean;
  withTheme?: boolean;
};

function Providers({
  children,
  route = "/",
  withNotifications = true,
  withTheme = false,
}: {
  children: ReactNode;
  route?: string;
  withNotifications?: boolean;
  withTheme?: boolean;
}) {
  let tree = <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;

  if (withNotifications) {
    tree = <NotificationProvider>{tree}</NotificationProvider>;
  }

  if (withTheme) {
    tree = <ThemeProvider>{tree}</ThemeProvider>;
  }

  return tree;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const {
    route,
    withNotifications,
    withTheme,
    ...renderOptions
  } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <Providers
        route={route}
        withNotifications={withNotifications}
        withTheme={withTheme}
      >
        {children}
      </Providers>
    ),
    ...renderOptions,
  });
}
