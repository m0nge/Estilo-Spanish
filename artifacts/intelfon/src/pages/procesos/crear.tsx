import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateProceso } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft, Hash, Antenna } from "lucide-react";

export default function CrearProceso() {
  const [, navigate] = useLocation();
  const [numeroPreoferta, setNumeroPreoferta] = useState("");
  const [prioridad, setPrioridad] = useState<"baja" | "media" | "alta" | "urgente">("baja");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateProceso({
    mutation: {
      onSuccess: (proceso: any) => {
        navigate(`/tracking/${proceso.id}`);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || "Error al crear el proceso. Intenta nuevamente.";
        setError(msg);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!numeroPreoferta.trim()) {
      setError("El número de preoferta es obligatorio.");
      return;
    }
    createMutation.mutate({ data: { numeroPreoferta: numeroPreoferta.trim(), prioridad } as any });
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nueva Orden de Activación</h2>
          <p className="text-sm text-gray-500">Ingresa el número de preoferta para iniciar el proceso</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Antenna className="h-5 w-5 text-red-600" />
            Datos de la Orden
          </CardTitle>
          <CardDescription>El sistema creará las etapas de activación automáticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {(error || createMutation.isError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error ?? "Error al crear el proceso."}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="preoferta">
                Número de Preoferta <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="preoferta"
                  placeholder="Ej: PO-2026-01-00123"
                  value={numeroPreoferta}
                  onChange={(e) => setNumeroPreoferta(e.target.value)}
                  className="pl-9 font-mono"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400">Este identificador es único por proceso</p>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente">🔴 Urgente</SelectItem>
                  <SelectItem value="alta">🟠 Alta</SelectItem>
                  <SelectItem value="media">🟡 Media</SelectItem>
                  <SelectItem value="baja">🟢 Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/dashboard" className="flex-1">
                <Button type="button" variant="outline" className="w-full">Cancelar</Button>
              </Link>
              <Button
                type="submit"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</>
                ) : "Iniciar Proceso"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
