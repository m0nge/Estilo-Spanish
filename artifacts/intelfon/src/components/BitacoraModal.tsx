import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, BookOpen, User, Phone, MessageSquare, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface BitacoraEntrada {
  id: number;
  autorNombre?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  comentario: string;
  creadoEn: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  procesoId: number;
  etapaProcesoId?: number;
  checklistItemId?: number;
  titulo?: string;
}

function formatFecha(d: string) {
  return new Date(d).toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function BitacoraModal({ open, onClose, procesoId, etapaProcesoId, checklistItemId, titulo }: Props) {
  const qc = useQueryClient();
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [comentario, setComentario] = useState("");
  const [adding, setAdding] = useState(false);

  const queryKey = ["bitacora", procesoId, etapaProcesoId, checklistItemId];

  const { data: entradas = [], isLoading } = useQuery<BitacoraEntrada[]>({
    queryKey,
    enabled: open,
    queryFn: async () => {
      const url = etapaProcesoId
        ? `/api/bitacora/etapa/${etapaProcesoId}`
        : `/api/bitacora/proceso/${procesoId}`;
      const res = await customFetch(url);
      if (!res.ok) throw new Error("Error cargando bitácora");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await customFetch("/api/bitacora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procesoId,
          etapaProcesoId: etapaProcesoId ?? null,
          checklistItemId: checklistItemId ?? null,
          contactoNombre: contactoNombre.trim() || null,
          contactoTelefono: contactoTelefono.trim() || null,
          comentario: comentario.trim(),
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setContactoNombre("");
      setContactoTelefono("");
      setComentario("");
      setAdding(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-red-600" />
            Bitácora {titulo ? `— ${titulo}` : ""}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-64 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : entradas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay entradas aún.</p>
          ) : (
            <div className="space-y-3">
              {entradas.map((e) => (
                <div key={e.id} className="border rounded-lg p-3 bg-gray-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <User className="h-3 w-3" /> {e.autorNombre ?? "Usuario"}
                    </span>
                    <span className="text-xs text-gray-400">{formatFecha(e.creadoEn)}</span>
                  </div>
                  {(e.contactoNombre || e.contactoTelefono) && (
                    <div className="flex gap-3 text-xs text-gray-500">
                      {e.contactoNombre && <span className="flex items-center gap-1"><User className="h-3 w-3" />{e.contactoNombre}</span>}
                      {e.contactoTelefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.contactoTelefono}</span>}
                    </div>
                  )}
                  <p className="text-sm text-gray-800 flex gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    {e.comentario}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="mt-2">
            <Plus className="h-4 w-4 mr-1" /> Agregar entrada
          </Button>
        ) : (
          <div className="mt-2 border-t pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre del contacto</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={contactoNombre}
                  onChange={(e) => setContactoNombre(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  placeholder="+56 9 1234 5678"
                  value={contactoTelefono}
                  onChange={(e) => setContactoTelefono(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comentario <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Describe la interacción o seguimiento..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!comentario.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
