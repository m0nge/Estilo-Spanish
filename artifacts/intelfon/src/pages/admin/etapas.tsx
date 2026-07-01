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
import { Plus, Pencil, Trash2, GripVertical, Loader2, CheckCircle2, Clock, Settings, ArrowUp, ArrowDown } from "lucide-react";

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
}

const COLORES_PREDEFINIDOS = [
  "#DC2626","#D97706","#16a34a","#2563EB","#7C3AED",
  "#DB2777","#0891B2","#65A30D","#EA580C","#9333EA",
];

function EtapaFormModal({ etapa, open, onClose, onSave }: {
  etapa?: ConfigEtapa; open: boolean; onClose: () => void; onSave: (data: Partial<ConfigEtapa>) => void;
}) {
  const [nombre, setNombre] = useState(etapa?.nombreEtapa ?? "");
  const [descripcion, setDescripcion] = useState(etapa?.descripcion ?? "");
  const [slaHoras, setSlaHoras] = useState(String(etapa?.slaHoras ?? 24));
  const [color, setColor] = useState(etapa?.color ?? "#DC2626");
  const [areas, setAreas] = useState((etapa?.areasInvolucradas ?? []).join(", "));

  const handleSave = () => {
    if (!nombre.trim()) return;
    onSave({
      nombreEtapa: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      slaHoras: parseInt(slaHoras) || 24,
      color,
      areasInvolucradas: areas.split(",").map(a => a.trim()).filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{etapa ? "Editar Etapa" : "Nueva Etapa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre <span className="text-red-500">*</span></Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Documentación y Digitalización" />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional" />
          </div>
          <div className="space-y-1.5">
            <Label>SLA (horas laborales)</Label>
            <Input type="number" min={1} value={slaHoras} onChange={e => setSlaHoras(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Áreas involucradas (separadas por coma)</Label>
            <Input value={areas} onChange={e => setAreas(e.target.value)} placeholder="Ventas, Activaciones, Bodega" />
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
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500 font-mono">{color}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 mt-2">
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
    queryFn: async () => {
      const res = await fetch("/api/admin/etapas", {
        headers: { Authorization: `Bearer ${localStorage.getItem("intelfon_token")}` }
      });
      if (!res.ok) throw new Error("Error cargando etapas");
      return res.json();
    },
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
    mutationFn: async (orden: { id: number; ordenVisualizacion: number }[]) => {
      await fetch("/api/admin/etapas-orden", { method: "PUT", headers: authHeader(), body: JSON.stringify(orden) });
    },
    onSuccess: () => invalidate(),
  });

  const mover = (idx: number, dir: -1 | 1) => {
    const arr = [...sorted];
    const target = arr[idx + dir];
    if (!target) return;
    const nuevoOrden = arr.map((e, i) => {
      if (i === idx) return { id: e.id, ordenVisualizacion: target.ordenVisualizacion };
      if (i === idx + dir) return { id: e.id, ordenVisualizacion: arr[idx].ordenVisualizacion };
      return { id: e.id, ordenVisualizacion: e.ordenVisualizacion };
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
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />SLA: {etapa.slaHoras}h laborales</span>
                      {(etapa.areasInvolucradas ?? []).length > 0 && (
                        <span className="flex items-center gap-1"><Settings className="h-3 w-3" />{etapa.areasInvolucradas.join(", ")}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: etapa.color }} />
                        <span className="font-mono text-gray-300">{etapa.color}</span>
                      </span>
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
