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
import { Loader2, Save, ChevronDown, ChevronUp, Clock, Plus, Trash2, GripVertical, ListChecks } from "lucide-react";

const AREAS = ["Admin", "Ventas", "Activaciones", "Bodega", "MSO", "Logistica"];

interface ChecklistTemplateItem {
  descripcion: string;
  area?: string;
}

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
      setEditData((prev) => ({
        ...prev,
        [id]: {
          ...etapa,
          checklistTemplate: (etapa.checklistTemplate as ChecklistTemplateItem[]) ?? [],
        },
      }));
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
        checklistTemplate: data.checklistTemplate,
      },
    });
  };

  // Checklist template helpers
  const addChecklistItem = (id: number) => {
    setEditData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        checklistTemplate: [
          ...(prev[id].checklistTemplate ?? []),
          { descripcion: "", area: "" },
        ],
      },
    }));
  };

  const removeChecklistItem = (id: number, idx: number) => {
    setEditData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        checklistTemplate: prev[id].checklistTemplate.filter((_: any, i: number) => i !== idx),
      },
    }));
  };

  const updateChecklistItem = (id: number, idx: number, field: "descripcion" | "area", value: string) => {
    setEditData((prev) => {
      const items = [...prev[id].checklistTemplate];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, [id]: { ...prev[id], checklistTemplate: items } };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuración de Etapas</h2>
        <p className="text-sm text-gray-500 mt-0.5">Administra los SLA, checklist y configuraciones de cada fase del workflow</p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-16" /></CardContent></Card>
          ))
        ) : (
          (etapas || []).map((etapa) => {
            const templateItems: ChecklistTemplateItem[] = (editData[etapa.id]?.checklistTemplate) ?? (etapa.checklistTemplate as ChecklistTemplateItem[]) ?? [];
            return (
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
                        <ListChecks className="h-3 w-3 text-gray-400 ml-1" />
                        <span className="text-xs text-gray-500">
                          {(etapa.checklistTemplate as ChecklistTemplateItem[])?.length ?? 0} tareas
                        </span>
                        <Badge variant="outline" className={etapa.activa ? "text-green-600 border-green-200" : "text-gray-400"}>
                          {etapa.activa ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {expanded === etapa.id ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>

                {expanded === etapa.id && editData[etapa.id] && (
                  <div className="border-t border-gray-100 p-4 space-y-5">
                    {/* SLA y Estado */}
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

                    {etapa.areasInvolucradas && etapa.areasInvolucradas.length > 0 && (
                      <div className="space-y-2">
                        <Label>Áreas Involucradas</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {(etapa.areasInvolucradas as string[]).map((area) => (
                            <Badge key={area} variant="secondary" className="text-xs">{area}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checklist Template */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <ListChecks className="h-4 w-4" />
                          Checklist de Tareas
                        </Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-7 text-xs"
                          onClick={() => addChecklistItem(etapa.id)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Agregar tarea
                        </Button>
                      </div>

                      {templateItems.length === 0 ? (
                        <div className="border border-dashed border-gray-200 rounded-md py-6 text-center">
                          <ListChecks className="h-6 w-6 text-gray-300 mx-auto mb-1.5" />
                          <p className="text-xs text-gray-400">Sin tareas de checklist. Haz clic en "Agregar tarea" para crear una.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {templateItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 group">
                              <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0 cursor-grab" />
                              <Input
                                className="flex-1 h-9 text-sm"
                                placeholder="Descripción de la tarea..."
                                value={item.descripcion}
                                onChange={(e) => updateChecklistItem(etapa.id, idx, "descripcion", e.target.value)}
                              />
                              <select
                                className="h-9 px-2 rounded-md border border-input bg-background text-xs w-36 flex-shrink-0"
                                value={item.area ?? ""}
                                onChange={(e) => updateChecklistItem(etapa.id, idx, "area", e.target.value)}
                                title="Área responsable de esta tarea"
                              >
                                <option value="">Sin área</option>
                                {AREAS.map((a) => (
                                  <option key={a} value={a}>{a}</option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-red-600 flex-shrink-0"
                                onClick={() => removeChecklistItem(etapa.id, idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Estas tareas se asignarán a cada proceso nuevo que pase por esta etapa. El área indica quién debe marcarla.
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
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
            );
          })
        )}
      </div>
    </div>
  );
}
