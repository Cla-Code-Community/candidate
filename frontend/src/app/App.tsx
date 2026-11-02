import { useState, useEffect } from "react";
import { AppRoutes } from "@/app/routes/AppRoutes";
import Loading from "@/shared/ui/Loading";

function App() {
  const [appCarregando, setAppCarregando] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppCarregando(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (appCarregando) {
    return <Loading />;
  }

  return (
    <AppRoutes />
  );
}

export default App;
