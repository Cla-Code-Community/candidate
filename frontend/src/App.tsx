import { useState, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import NotFound from "./not_found";
import Loading from "./Loading";

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
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
