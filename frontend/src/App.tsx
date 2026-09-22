import { useState, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplashScreen } from "@/components/SplashScreen";
import { BackendWakingOverlay } from "@/components/BackendWakingOverlay";
import { DataSourceProvider } from "@/context/DataSourceContext";

// Layouts
import { Layout } from "@/components/layout/Layout";
import { LandingLayout } from "@/components/layout/LandingLayout";

// Pages
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import MapPage from "@/pages/MapPage";
import CityDetail from "@/pages/CityDetail";
import Analytics from "@/pages/Analytics";
import Advisor from "@/pages/Advisor";
import Forecast from "@/pages/Forecast";
import HistoryPage from "@/pages/History";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 mins
      retry: 1
    },
  },
});

function DashboardRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/map" component={MapPage} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/advisor" component={Advisor} />
        <Route path="/forecast" component={Forecast} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/city/:cityId" component={CityDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Landing Page with Editorial Layout */}
      <Route path="/">
        <LandingLayout>
          <Home />
        </LandingLayout>
      </Route>
      
      {/* All Dashboard Pages */}
      <Route path="/dashboard*"><DashboardRoutes /></Route>
      <Route path="/map*"><DashboardRoutes /></Route>
      <Route path="/analytics*"><DashboardRoutes /></Route>
      <Route path="/advisor*"><DashboardRoutes /></Route>
      <Route path="/forecast*"><DashboardRoutes /></Route>
      <Route path="/history*"><DashboardRoutes /></Route>
      <Route path="/city/*"><DashboardRoutes /></Route>
      
      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <DataSourceProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
            <BackendWakingOverlay />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </DataSourceProvider>
    </ThemeProvider>
  );
}

export default App;
