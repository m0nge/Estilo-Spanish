import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import CrearProceso from "./pages/procesos/crear";
import TrackingVista from "./pages/tracking/[id]";
import EtapaVista from "./pages/etapa/[idProceso]/[numeroEtapa]";
import AdminEtapas from "./pages/admin/etapas";
import AdminUsuarios from "./pages/admin/usuarios";
import AdminReportes from "./pages/admin/reportes";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: any) {
  const { usuario, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || !usuario) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && usuario.rol !== "Admin") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/procesos/crear">
        {() => <ProtectedRoute component={CrearProceso} />}
      </Route>
      <Route path="/tracking/:id">
        {(params) => <ProtectedRoute component={TrackingVista} id={params.id} />}
      </Route>
      <Route path="/etapa/:idProceso/:numeroEtapa">
        {(params) => <ProtectedRoute component={EtapaVista} idProceso={params.idProceso} numeroEtapa={params.numeroEtapa} />}
      </Route>
      
      {/* Admin Routes */}
      <Route path="/admin/etapas">
        {() => <ProtectedRoute component={AdminEtapas} adminOnly={true} />}
      </Route>
      <Route path="/admin/usuarios">
        {() => <ProtectedRoute component={AdminUsuarios} adminOnly={true} />}
      </Route>
      <Route path="/admin/reportes">
        {() => <ProtectedRoute component={AdminReportes} adminOnly={true} />}
      </Route>

      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
