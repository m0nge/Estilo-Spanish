import { useCallback, useState } from "react";
import { Link } from "wouter";
import {
  useGetEtapa, useGetChecklist, useToggleChecklistItem,
  useCompletarEtapa, useJustificarEtapa, useGetChatMensajes, useSendChatMensaje,
  useListUsuarios
} from "@workspace/api-client-react";
import { useAuth } from "../../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CheckCircle2, Clock, MessageSquare, AlertTriangle, Loader2, BookOpen
} from "lucide-react";
import ChatBox from "../../../components/ChatBox";
import Cronometro from "../../../components/Cronometro";
import BitacoraModal from "../../../components/BitacoraModal";

interface Props {
  idProceso: string;
  numeroEtapa: string;
}

const FASE_NOMBRES: Record<number, string> = {
  1: "Documentación y Digitalización", 2: "STR y Despacho",
  3: "Configuración de Dispositivos", 4: "Armado y Configuración Física", 5: "Entrega y Capacitación"
};

function formatFechaCorta(d: string | Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

export default function EtapaVista({ idProceso, numeroEtapa }: Props) {
  const procesoId = parseInt(idProceso);
  const etapaNum = parseInt(numeroEtapa);
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [justificacionOpen, setJustificacionOpen] = useState(false);
  const [justificacion, setJustificacion] = useState("");
  const [bitacoraItem, setBitacoraItem] = useState<{ id: number; etapaId: number; desc: string } | null>(null);
  const [bitacoraEtapaOpen, setBitacoraEtapaOpen] = useState(false);

  const { data: etapa, isLoading, refetch } = useGetEtapa(procesoId, etapaNum, {
    query: { enabled: !isNaN(procesoId) && !isNaN(etapaNum) },
  });

  const { data: checklist, isLoading: checklistLoading, refetch: refetchChecklist } = useGetChecklist(
    etapa?.id ?? 0, { query: { enabled: !!etapa?.id } }
  );

  const { data: mensajes = [], refetch: refetchMensajes } = useGetChatMensajes(
    procesoId, etapaNum, etapaNum, { query: { enabled: !isNaN(procesoId) } }
  );

  const { data: usuariosAdmin = [] } = useListUsuarios({ query: { enabled: usuario?.rol === "Admin" } });

  const toggleMutation = useToggleChecklistItem({
    mutation: { onSuccess: () => refetchChecklist() },
  });

  const completarMutation = useCompletarEtapa({
    mutation: {
      onSuccess: () => { toast({ title: "✅ Etapa completada exitosamente" }); refetch(); },
      onError: () => {
        toast({ title: "No se puede completar", description: "Completa todos los items del checklist primero.", variant: "destructive" });
      },
    },
  });

  const justificarMutation = useJustificarEtapa({
    mutation: {
      onSuccess: () => {
        toast({ title: "Justificación enviada" });
        setJustificacionOpen(false);
        setJustificacion("");
        refetch();
      },
    },
  });

  const sendMutation = useSendChatMensaje({
    mutation: { onSuccess: () => refetchMensajes() },
  });

  const handleToggle = (itemId: number, currentValue: boolean) => {
    toggleMutation.mutate({ itemId, data: { completado: !currentValue } });
  };

  const handleCompletar = () => completarMutation.mutate({ id: procesoId, numeroEtapa: etapaNum });

  const handleJustificar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificacion.trim()) return;
    justificarMutation.mutate({ id: procesoId, numeroEtapa: etapaNum, data: { justificacion } });
  };

  const handleSendChat = useCallback((contenido: string, imagenBase64?: string) => {
    sendMutation.mutate({ id: procesoId, etapaOrigen: etapaNum, etapaDestino: etapaNum, data: { contenido, imagenBase64 } });
  }, [procesoId, etapaNum, sendMutation]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!etapa) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Etapa no encontrada.</p>
        <Link href={`/tracking/${procesoId}`}>
          <Button variant="outline" className="mt-4">Volver al Proceso</Button>
        </Link>
      </div>
    );
  }

  const checklistItems = checklist || etapa.checklist || [];
  const itemsCompletados = checklistItems.filter((i: any) => i.completado).length;
  const totalItems = checklistItems.length;
  const todosCompletados = totalItems > 0 && itemsCompletados === totalItems;
  const pctChecklist = totalItems > 0 ? (itemsCompletados / totalItems) * 100 : 0;
  const esCompletada = etapa.estado === "completada";
  const minutosRestantes = etapa.minutosRestantes;
  const horasRestantes = minutosRestantes != null ? Math.abs(Math.round(minutosRestantes / 60)) : null;
  const slaVencido = etapa.slaVencido;
  const semaforoColor = slaVencido ? "text-red-600" :
    minutosRestantes != null && minutosRestantes < (etapa.slaEtapaHoras ?? 24) * 60 * 0.2 ? "text-amber-500" :
    "text-green-600";

  const usuariosMencion = (usuariosAdmin as any[]).map((u: any) => ({ id: u.id, nombre: u.nombre }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/tracking/${procesoId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="h-8 w-8 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: (etapa as any).color ?? "#DC2626" }}
            >
              {etapaNum}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {etapa.nombreEtapa || FASE_NOMBRES[etapaNum]}
            </h2>
            <Badge variant="outline" className={
              esCompletada ? "text-green-600 border-green-200" :
              slaVencido ? "text-red-600 border-red-200" :
              "text-blue-600 border-blue-200"
            }>
              {esCompletada ? "✅ Completada" : slaVencido ? "🔴 SLA Vencido" : etapa.estado}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" className="flex-shrink-0 gap-1.5" onClick={() => setBitacoraEtapaOpen(true)}>
          <BookOpen className="h-4 w-4" /> Bitácora
        </Button>
      </div>

      {/* Cronómetro de etapa */}
      {!esCompletada && etapa.fechaInicio && (
        <Cronometro
          fechaInicio={etapa.fechaInicio}
          slaHoras={etapa.slaEtapaHoras ?? 24}
          label={`Cronómetro de esta fase (${etapa.nombreEtapa || FASE_NOMBRES[etapaNum]})`}
        />
      )}

      {/* SLA Bar */}
      {!esCompletada && horasRestantes != null && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between text-sm">
              <span className={`flex items-center gap-1.5 font-medium ${semaforoColor}`}>
                <Clock className="h-4 w-4" />
                {slaVencido
                  ? `🔴 SLA vencido — ${horasRestantes}h de retraso`
                  : minutosRestantes != null && minutosRestantes < (etapa.slaEtapaHoras ?? 24) * 60 * 0.2
                  ? `🟡 ${horasRestantes}h restantes (SLA próximo a vencer)`
                  : `🟢 ${horasRestantes}h restantes para SLA (${etapa.slaEtapaHoras}h total)`}
              </span>
              {(etapa.areasInvolucradas ?? []).length > 0 && (
                <span className="text-xs text-gray-400">{(etapa.areasInvolucradas as string[]).join(" / ")}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-red-600" />
              Checklist de Etapa
            </CardTitle>
            <span className="text-sm text-gray-500">{itemsCompletados}/{totalItems}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${todosCompletados ? "bg-green-500" : "bg-red-500"}`}
              style={{ width: `${pctChecklist}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {checklistLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)
          ) : checklistItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay items configurados.</p>
          ) : (
            checklistItems.map((item: any) => (
              <div key={item.id} className={`rounded-lg transition-colors border ${
                item.completado ? "bg-green-50 border-green-100" : "bg-gray-50 border-transparent"
              }`}>
                <div className="flex items-start gap-3 p-3">
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={item.completado}
                    disabled={esCompletada || toggleMutation.isPending}
                    onCheckedChange={() => !esCompletada && handleToggle(item.id, item.completado)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={`item-${item.id}`} className={`text-sm cursor-pointer leading-relaxed block ${
                      item.completado ? "line-through text-gray-400" : "text-gray-700"
                    } ${esCompletada ? "cursor-default" : ""}`}>
                      {item.descripcion}
                    </label>
                    {item.areaResponsable && (
                      <p className={`text-xs mt-0.5 font-medium ${item.completado ? "text-gray-300" : "text-red-500"}`}>
                        {item.areaResponsable}
                      </p>
                    )}
                    {item.completado && item.fechaCompletado && (
                      <p className="text-xs text-green-600 mt-0.5">
                        ✅ {formatFechaCorta(item.fechaCompletado)}
                        {item.usuarioQuienCompletoId ? "" : ""}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-gray-300 hover:text-gray-600 flex-shrink-0"
                    onClick={() => setBitacoraItem({ id: item.id, etapaId: etapa.id, desc: item.descripcion })}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {!esCompletada && (
            <div className="flex gap-3 pt-3 border-t">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleCompletar}
                disabled={completarMutation.isPending || !todosCompletados}
                title={!todosCompletados ? "Completa todos los items del checklist primero" : ""}
              >
                {completarMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Completando...</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />Completar Etapa</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setJustificacionOpen(true)}
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Justificar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat de Etapa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat de Etapa
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ChatBox
            mensajes={mensajes as any}
            usuarioId={usuario?.id}
            isPending={sendMutation.isPending}
            onSend={handleSendChat}
            placeholder="Escribe un mensaje o envía una foto... usa @nombre para mencionar"
            usuarios={usuariosMencion}
          />
        </CardContent>
      </Card>

      {/* Bitácora de la etapa completa */}
      {bitacoraEtapaOpen && etapa.id && (
        <BitacoraModal
          open={bitacoraEtapaOpen}
          onClose={() => setBitacoraEtapaOpen(false)}
          procesoId={procesoId}
          etapaProcesoId={etapa.id}
          titulo={etapa.nombreEtapa || FASE_NOMBRES[etapaNum]}
        />
      )}

      {/* Bitácora de item específico */}
      {bitacoraItem && (
        <BitacoraModal
          open={!!bitacoraItem}
          onClose={() => setBitacoraItem(null)}
          procesoId={procesoId}
          etapaProcesoId={etapa.id}
          checklistItemId={bitacoraItem.id}
          titulo={bitacoraItem.desc}
        />
      )}

      {/* Justificación Dialog */}
      <Dialog open={justificacionOpen} onOpenChange={setJustificacionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar Avance de Etapa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJustificar} className="space-y-4">
            <p className="text-sm text-gray-600">
              Puedes completar la etapa sin terminar todos los items. Por favor explica el motivo.
            </p>
            <Textarea
              placeholder="Ingresa la justificación..."
              rows={4}
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setJustificacionOpen(false)}>Cancelar</Button>
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600"
                disabled={justificarMutation.isPending || !justificacion.trim()}
              >
                {justificarMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                ) : "Enviar Justificación"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
