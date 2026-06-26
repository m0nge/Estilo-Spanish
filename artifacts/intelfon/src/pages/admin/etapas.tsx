import { useState } from "react";
import { useListConfigEtapas, useUpdateConfigEtapa } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ChevronDown, ChevronUp, Clock } from "lucide-react";

export default function AdminEtapas() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<number, any>>({});

  const { data: etapas, isLoading, refetch } = useListConfigEtapas();
  const updateMutation = useUpdateConfigEtapa({
    mutation: {
      onSuccess: () => {
        toast({ title: "Etapa actualizada", description: "Configuración guardada correctamente." });
        refetch();
      },
      onError: () => {
        toast({ title: "Error", description: "No se pudo guardar la configuración.", variant: "destructive" });
      },
    },
  });

  const handleExpand = (id: number, etapa: any) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      setEditData((prev) => ({ ...prev, [id]: { ...etapa } }));
    }
  };

  const handleSave = (id: number) => {
    const data = editData[id];
    updateMutation.mutate({
      id,
      data: {
        slaHoras: data.slaHoras,
        descripcion: data.descripcion,
        activa: data.activa,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuración de Etapas</h2>
        <p className="text-sm text-gray-500 mt-0.5">Administra los SLA y configuraciones de cada fase del workflow</p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-16" /></CardContent></Card>
          ))
        ) : (
          (etapas || []).map((etapa) => (
            <Card key={etapa.id} className={`transition-all ${expanded === etapa.id ? "ring-2 ring-red-200" : ""}`}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => handleExpand(etapa.id, etapa)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {etapa.numeroEtapa}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{etapa.nombreEtapa}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">SLA: {etapa.slaHoras}h</span>
                      <Badge variant="outline" className={etapa.activa ? "text-green-600 border-green-200" : "text-gray-400"}>
                        {etapa.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                  </div>
                </div>
                {expanded === etapa.id ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </div>

              {expanded === etapa.id && editData[etapa.id] && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SLA (horas)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editData[etapa.id].slaHoras}
                        onChange={(e) => setEditData((prev) => ({
                          ...prev,
                          [etapa.id]: { ...prev[etapa.id], slaHoras: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        value={editData[etapa.id].activa ? "activa" : "inactiva"}
                        onChange={(e) => setEditData((prev) => ({
                          ...prev,
                          [etapa.id]: { ...prev[etapa.id], activa: e.target.value === "activa" }
                        }))}
                      >
                        <option value="activa">Activa</option>
                        <option value="inactiva">Inactiva</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea
                      rows={2}
                      value={editData[etapa.id].descripcion || ""}
                      onChange={(e) => setEditData((prev) => ({
                        ...prev,
                        [etapa.id]: { ...prev[etapa.id], descripcion: e.target.value }
                      }))}
                    />
                  </div>

                  {etapa.areasInvolucradas && (
                    <div className="space-y-2">
                      <Label>Áreas Involucradas</Label>
                      <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                        {etapa.areasInvolucradas.join(", ")}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => handleSave(etapa.id)}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                      ) : (
                        <><Save className="mr-2 h-4 w-4" />Guardar Cambios</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
