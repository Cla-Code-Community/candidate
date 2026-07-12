import { NotificationProvider } from "../notifications/NotificationProvider";
import { ThemeProvider } from "./ThemeProvider";
// import { AuthProvider } from './AuthProvider'; // exemplo, se/quando existir

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ThemeProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </ThemeProvider>
  );
};
