import { useState, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import LandingPage from "./pages/dashboard/LandingPage";
import Dashboard from "./pages/dashboard/Dashboard";
import NotFound from "./not_found";
import Loading from "./Loading";
import LoginPage from "./pages/login/LoginPage";

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
      <Route path="/login" element={<LoginPage/> } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
