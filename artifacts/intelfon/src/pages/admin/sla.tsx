import { useGetSlaConfig, useUpdateSlaConfig } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Clock, AlertTriangle } from "lucide-react";

export default function AdminSla() {
  const { toast } = useToast();
  const { data: config, isLoading, refetch } = useGetSlaConfig();
  const [slaGlobal, setSlaGlobal] = useState(120);
  const [alertaPct, setAlertaPct] = useState(80);

  useEffect(() => {
    if (config) {
      setSlaGlobal(config.slaGlobalHoras);
      setAlertaPct(config.alertaPorcentaje);
    }
  }, [config]);

  const updateMutation = useUpdateSlaConfig({
    mutation: {
      onSuccess: () => {
        toast({ title: "Configuración SLA actualizada" });
        refetch();
      },
      onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      slaGlobalHoras: slaGlobal,
      alertaPorcentaje: alertaPct,
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuración SLA Global</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Define los tiempos límite de atención para todos los procesos
        </p>
      </div>

      {isLoading ? (
        <Card><CardContent className="pt-6"><Skeleton className="h-48" /></CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-600" />
              Parámetros de SLA
            </CardTitle>
            <CardDescription>
              Estos valores se aplican como referencia global para alertas y reportes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="sla_global">SLA Global (horas)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="sla_global"
                    type="number"
                    min={1}
                    value={slaGlobal}
                    onChange={(e) => setSlaGlobal(parseInt(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-gray-500">
                    = {Math.floor(slaGlobal / 24)} días {slaGlobal % 24 > 0 ? `y ${slaGlobal % 24}h` : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Tiempo máximo total para completar un proceso de activación desde el inicio hasta la entrega.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alerta_pct" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  Umbral de Alerta (%)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="alerta_pct"
                    type="number"
                    min={1}
                    max={100}
                    value={alertaPct}
                    onChange={(e) => setAlertaPct(parseInt(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-gray-500">
                    alerta cuando se alcance el {alertaPct}% del SLA
                  </span>
                </div>
              </div>

              {config && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-gray-600">Configuración actual:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">SLA Global:</span>
                      <span className="ml-2 font-medium">{config.slaGlobalHoras}h</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Umbral alerta:</span>
                      <span className="ml-2 font-medium">{config.alertaPorcentaje}%</span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Guardar Configuración</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
