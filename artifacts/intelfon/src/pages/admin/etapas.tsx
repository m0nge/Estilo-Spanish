import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Pencil, Trash2, GripVertical, Loader2, CheckCircle2, Clock,
  Settings, ArrowUp, ArrowDown, ListChecks, Bell, X
} from "lucide-react";

interface ChecklistTemplateItem {
  descripcion: string;
  area?: string;
  notificarAreas?: string[];
}

interface ConfigEtapa {
  id: number;
  numeroEtapa: number;
  nombreEtapa: string;
  descripcion?: string;
  slaHoras: number;
  color: string;
  activa: boolean;
  ordenVisualizacion: number;
  areasInvolucradas: string[];
  checklistTemplate?: ChecklistTemplateItem[];
}

const COLORES_PREDEFINIDOS = [
  "#DC2626","#D97706","#16a34a","#2563EB","#7C3AED",
  "#DB2777","#0891B2","#65A30D","#EA580C","#9333EA",
];

const AREAS_DISPONIBLES = [
  "Ventas", "Activaciones", "Bodega", "MSO", "Logística", "Administración", "Soporte"
];

function ChecklistEditor({
  items, onChange,
}: {
  items: ChecklistTemplateItem[];
  onChange: (items: ChecklistTemplateItem[]) => void;
}) {
  const addItem = () => onChange([...items, { descripcion: "", area: "", notificarAreas: [] }]);

  const updateItem = (idx: number, patch: Partial<ChecklistTemplateItem>) =>
    onChange(items.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const moveItem = (idx: number, dir: -1 | 1) => {
    const arr = [...items];
    const swapWith = arr[idx + dir];
    if (!swapWith) return;
    arr[idx + dir] = arr[idx];
    arr[idx] = swapWith;
    onChange(arr);
  };

  const toggleNotifArea = (idx: number, area: string) => {
    const cur = items[idx].notificarAreas ?? [];
    updateItem(idx, { notificarAreas: cur.includes(area) ? cur.filter(a => a !== area) : [...cur, area] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <ListChecks className="h-4 w-4 text-red-600" />
          Tareas del Checklist
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Agregar tarea
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic py-2 text-center">Sin tareas configuradas. Haz clic en "Agregar tarea".</p>
      )}

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5 pt-1 flex-shrink-0">
                <button type="button" disabled={idx === 0}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                  onClick={() => moveItem(idx, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </button>
                <GripVertical className="h-3.5 w-3.5 text-gray-300 mx-auto" />
                <button type="button" disabled={idx === items.length - 1}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                  onClick={() => moveItem(idx, 1)}>
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <Input
                  value={item.descripcion}
                  onChange={e => updateItem(idx, { descripcion: e.target.value })}
                  placeholder="Descripción de la tarea..."
                  className="h-8 text-sm"
                />
                <select
                  value={item.area ?? ""}
                  onChange={e => updateItem(idx, { area: e.target.value })}
                  className="w-full h-7 text-xs border border-gray-200 rounded px-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="">Área responsable (opcional)...</option>
                  {AREAS_DISPONIBLES.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Bell className="h-3 w-3 text-amber-500" />
                    Notificar por correo al completar:
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {AREAS_DISPONIBLES.map(a => (
                      <label key={a} className="flex items-center gap-1 cursor-pointer">
                        <Checkbox
                          checked={(item.notificarAreas ?? []).includes(a)}
                          onCheckedChange={() => toggleNotifArea(idx, a)}
                          className="h-3 w-3 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                        />
                        <span className="text-[11px] text-gray-600">{a}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => removeItem(idx)}
                className="flex-shrink-0 text-red-400 hover:text-red-600 mt-0.5">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EtapaFormModal({ etapa, open, onClose, onSave }: {
  etapa?: ConfigEtapa; open: boolean; onClose: () => void; onSave: (data: Partial<ConfigEtapa>) => void;
}) {
  const [nombre, setNombre] = useState(etapa?.nombreEtapa ?? "");
  const [descripcion, setDescripcion] = useState(etapa?.descripcion ?? "");
  const [slaHoras, setSlaHoras] = useState(String(etapa?.slaHoras ?? 24));
  const [color, setColor] = useState(etapa?.color ?? "#DC2626");
  const [areas, setAreas] = useState((etapa?.areasInvolucradas ?? []).join(", "));
  const [checklist, setChecklist] = useState<ChecklistTemplateItem[]>(etapa?.checklistTemplate ?? []);

  const handleSave = () => {
    if (!nombre.trim()) return;
    onSave({
      nombreEtapa: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      slaHoras: parseInt(slaHoras) || 24,
      color,
      areasInvolucradas: areas.split(",").map(a => a.trim()).filter(Boolean),
      checklistTemplate: checklist.filter(i => i.descripcion.trim()),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{etapa ? "Editar Etapa" : "Nueva Etapa"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Nombre <span className="text-red-500">*</span></Label>
                <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Documentación y Digitalización" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Descripción</Label>
                <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional" />
              </div>
              <div className="space-y-1.5">
                <Label>SLA (horas laborales)</Label>
                <Input type="number" min={1} value={slaHoras} onChange={e => setSlaHoras(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Áreas involucradas (coma)</Label>
                <Input value={areas} onChange={e => setAreas(e.target.value)} placeholder="Ventas, Activaciones" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {COLORES_PREDEFINIDOS.map(c => (
                  <button key={c} type="button"
                    className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                ))}
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="h-7 w-7 rounded cursor-pointer border border-gray-200" title="Color personalizado" />
              </div>
            </div>

            <div className="border-t pt-4">
              <ChecklistEditor items={checklist} onChange={setChecklist} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={!nombre.trim()} onClick={handleSave}>
            {etapa ? "Guardar cambios" : "Crear etapa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminEtapas() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<ConfigEtapa | null>(null);
  const [creando, setCreando] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: etapas = [], isLoading } = useQuery<ConfigEtapa[]>({
    queryKey: ["admin-etapas"],
    queryFn: () => customFetch<ConfigEtapa[]>("/api/admin/etapas"),
  });

  const sorted = [...etapas].sort((a, b) => a.ordenVisualizacion - b.ordenVisualizacion);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-etapas"] });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("intelfon_token")}`, "Content-Type": "application/json" });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ConfigEtapa> }) => {
      const res = await fetch(`/api/admin/etapas/${id}`, { method: "PUT", headers: authHeader(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Error actualizando");
    },
    onSuccess: () => { invalidate(); setEditando(null); showSuccess("Etapa actualizada"); },
  });

  const createMut = useMutation({
    mutationFn: async (data: Partial<ConfigEtapa>) => {
      const res = await fetch("/api/admin/etapas", { method: "POST", headers: authHeader(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Error creando");
    },
    onSuccess: () => { invalidate(); setCreando(false); showSuccess("Etapa creada"); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/etapas/${id}`, { method: "DELETE", headers: authHeader() });
    },
    onSuccess: () => { invalidate(); showSuccess("Etapa desactivada"); },
  });

  const moverMut = useMutation({
    mutationFn: async (orden: { id: number; ordenVisualizacion: number; numeroEtapa: number }[]) => {
      await fetch("/api/admin/etapas-orden", { method: "PUT", headers: authHeader(), body: JSON.stringify(orden) });
    },
    onSuccess: () => invalidate(),
  });

  const mover = (idx: number, dir: -1 | 1) => {
    const arr = [...sorted];
    const swapWith = arr[idx + dir];
    if (!swapWith) return;
    const current = arr[idx];
    const nuevoOrden = arr.map((e, i) => {
      if (i === idx) return { id: e.id, ordenVisualizacion: swapWith.ordenVisualizacion, numeroEtapa: swapWith.numeroEtapa };
      if (i === idx + dir) return { id: e.id, ordenVisualizacion: current.ordenVisualizacion, numeroEtapa: current.numeroEtapa };
      return { id: e.id, ordenVisualizacion: e.ordenVisualizacion, numeroEtapa: e.numeroEtapa };
    });
    moverMut.mutate(nuevoOrden);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuración de Etapas</h2>
          <p className="text-sm text-gray-500">Administra las fases del proceso de activación</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setCreando(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Etapa
        </Button>
      </div>

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">No hay etapas. Crea la primera.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((etapa, idx) => (
            <Card key={etapa.id} className={`border-l-4 ${!etapa.activa ? "opacity-60" : ""}`} style={{ borderLeftColor: etapa.color }}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-300 hover:text-gray-600"
                      disabled={idx === 0 || moverMut.isPending} onClick={() => mover(idx, -1)}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <GripVertical className="h-4 w-4 text-gray-300 mx-auto" />
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-300 hover:text-gray-600"
                      disabled={idx === sorted.length - 1 || moverMut.isPending} onClick={() => mover(idx, 1)}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: etapa.color }}>
                    {etapa.numeroEtapa}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{etapa.nombreEtapa}</span>
                      {!etapa.activa && <Badge variant="secondary" className="text-xs">Inactiva</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />SLA: {etapa.slaHoras}h</span>
                      {(etapa.areasInvolucradas ?? []).length > 0 && (
                        <span className="flex items-center gap-1"><Settings className="h-3 w-3" />{etapa.areasInvolucradas.join(", ")}</span>
                      )}
                      {(etapa.checklistTemplate ?? []).length > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <ListChecks className="h-3 w-3" />{etapa.checklistTemplate!.length} tareas
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => setEditando(etapa)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {etapa.activa && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600"
                        onClick={() => { if (confirm("¿Desactivar esta etapa?")) deleteMut.mutate(etapa.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {(etapa.checklistTemplate ?? []).length > 0 && (
                  <div className="mt-3 ml-16 pl-2 border-l-2 border-gray-100 space-y-1">
                    {etapa.checklistTemplate!.slice(0, 4).map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                        <CheckCircle2 className="h-3 w-3 text-gray-300 flex-shrink-0" />
                        <span className="truncate">{item.descripcion}</span>
                        {item.area && <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">{item.area}</Badge>}
                        {(item.notificarAreas ?? []).length > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600 flex-shrink-0">
                            <Bell className="h-2.5 w-2.5" />
                            {item.notificarAreas!.join(", ")}
                          </span>
                        )}
                      </div>
                    ))}
                    {etapa.checklistTemplate!.length > 4 && (
                      <p className="text-[11px] text-gray-400 ml-5">+{etapa.checklistTemplate!.length - 4} más...</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creando && (
        <EtapaFormModal open={creando} onClose={() => setCreando(false)} onSave={data => createMut.mutate(data)} />
      )}
      {editando && (
        <EtapaFormModal etapa={editando} open={!!editando} onClose={() => setEditando(null)}
          onSave={data => updateMut.mutate({ id: editando!.id, data })} />
      )}
    </div>
  );
}
