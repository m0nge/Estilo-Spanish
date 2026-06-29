import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import logoUrl from "@assets/image_1782498618865.png";

export default function Login() {
  const [, navigate] = useLocation();
  const { setToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setToken(data.token);
        navigate("/dashboard");
      },
      onError: () => {
        setError("Credenciales incorrectas. Por favor verifica tu email y contraseña.");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-red-900 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={logoUrl} alt="RED Intelfon" className="h-20 w-auto drop-shadow-lg" />
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center text-gray-900">
              Workflow Activaciones
            </CardTitle>
            <CardDescription className="text-center text-gray-500">
              Ingresa tus credenciales para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@intelfon.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-2">
              <p className="font-medium text-gray-600 mb-2">Acceso rápido (clic para rellenar):</p>
              {[
                { email: "admin@intelfon.com", label: "Admin" },
                { email: "ventas@intelfon.com", label: "Ventas" },
                { email: "activaciones@intelfon.com", label: "Activaciones" },
                { email: "bodega@intelfon.com", label: "Bodega" },
                { email: "mso@intelfon.com", label: "MSO" },
                { email: "logistica@intelfon.com", label: "Logística" },
              ].map((u) => (
                <button
                  key={u.email}
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-200 transition-colors flex justify-between items-center"
                  onClick={() => { setEmail(u.email); setPassword("intelfon2024"); }}
                >
                  <span className="text-gray-600">{u.email}</span>
                  <span className="text-gray-400 ml-2 shrink-0">{u.label}</span>
                </button>
              ))}
              <p className="text-gray-400 pt-1 border-t border-gray-200">Contraseña: <span className="font-mono font-semibold text-gray-600">intelfon2024</span></p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          RED Intelfon © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
