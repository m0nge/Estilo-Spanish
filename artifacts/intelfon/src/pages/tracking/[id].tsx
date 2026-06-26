import { Link } from "wouter";
import { useGetProceso, useGetChatMensajes, useSendChatMensaje } from "@workspace/api-client-react";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  ArrowLeft, CheckCircle2, Circle, AlertTriangle, ChevronRight,
  Send, MessageSquare, User, ArrowUpCircle
} from "lucide-react";

interface Props {
  id: string;
}

const FASE_NOMBRES = [
  "", "Documentación y Digitalización", "STR y Despacho",
  "Configuración de Dispositivos", "Armado y Configuración Física", "Entrega y Capacitación"
];

const FASE_AREAS = [
  "", "Ventas/Activaciones", "Activaciones/Bodega", "Activaciones/MSO",
  "Bodega/Activaciones", "Activaciones/Logística"
];

function EtapaIcon({ estado, numero, actual }: { estado: string; numero: number; actual: boolean }) {
  if (estado === "completada") return <CheckCircle2 className="h-6 w-6 text-green-500" />;
  if (actual) return (
    <div className="h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">
      {numero}
    </div>
  );
  return <Circle className="h-6 w-6 text-gray-300" />;
}

export default function TrackingVista({ id }: Props) {
  const procesoId = parseInt(id);
  const { usuario } = useAuth();
  const [mensaje, setMensaje] = useState("");

  const { data: proceso, isLoading: procesoLoading } = useGetProceso(procesoId, {
    query: { enabled: !isNaN(procesoId) },
  });

  const { data: mensajes, refetch: refetchMensajes } = useGetChatMensajes(procesoId, 0, 0, {
    query: { enabled: !isNaN(procesoId) },
  });

  const sendMutation = useSendChatMensaje({
    mutation: {
      onSuccess: () => {
        setMensaje("");
        refetchMensajes();
      },
    },
  });

  const handleSendMensaje = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim()) return;
    sendMutation.mutate({ id: procesoId, etapaOrigen: 0, etapaDestino: 0, data: { contenido: mensaje.trim() } });
  };

  if (procesoLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!proceso) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Proceso no encontrado.</p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-4">Volver al Dashboard</Button>
        </Link>
      </div>
    );
  }

  const canAcceder = (etapaNumero: number) => {
    const area = usuario?.area || "";
    const areaEtapa = FASE_AREAS[etapaNumero] || "";
    return usuario?.rol === "Admin" || areaEtapa.includes(area);
  };

  const etapaActual = proceso.etapaActual || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{proceso.clienteNombre}</h2>
            {(proceso.prioridad === "alta" || proceso.prioridad === "urgente") && (
              <ArrowUpCircle className="h-5 w-5 text-orange-500" />
            )}
            <Badge variant="outline" className="text-xs font-mono">{proceso.numeroPreoferta}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-gray-500">
            {proceso.codigoStr && <span className="font-mono text-xs">{proceso.codigoStr}</span>}
            {proceso.codigoB800 && <span className="font-mono text-xs">{proceso.codigoB800}</span>}
            {proceso.codigoR800 && <span className="font-mono text-xs">{proceso.codigoR800}</span>}
          </div>
        </div>
        <Badge className={proceso.estadoActual === "completado" ? "bg-green-100 text-green-700 border-green-200" :
          proceso.slaVencido ? "bg-red-100 text-red-700 border-red-200" :
            "bg-blue-100 text-blue-700 border-blue-200"}>
          {proceso.estadoActual}
        </Badge>
      </div>

      {/* SLA Global indicator */}
      {proceso.slaVencido && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>SLA vencido — proceso fuera del tiempo límite de {proceso.slaGlobalHoras}h</span>
        </div>
      )}

      {/* Etapas timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Progreso del Proceso</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1">
            {(proceso.etapas || []).map((etapa, idx) => {
              const esActual = etapa.numeroEtapa === etapaActual;
              const accesoPermitido = canAcceder(etapa.numeroEtapa);
              const minutosRestantes = etapa.minutosRestantes;
              const horasRestantes = minutosRestantes != null ? Math.abs(Math.round(minutosRestantes / 60)) : null;

              return (
                <div key={etapa.id}>
                  {idx > 0 && <div className="ml-3 w-px h-3 bg-gray-200" />}
                  <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    esActual ? "bg-red-50 border border-red-200" : "hover:bg-gray-50"
                  }`}>
                    <EtapaIcon estado={etapa.estado} numero={etapa.numeroEtapa} actual={esActual} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${esActual ? "text-red-700" : "text-gray-700"}`}>
                        Etapa {etapa.numeroEtapa}: {etapa.nombreEtapa || FASE_NOMBRES[etapa.numeroEtapa]}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{FASE_AREAS[etapa.numeroEtapa]}</span>
                        {etapa.estado === "completada" && etapa.fechaFin && (
                          <span className="text-xs text-gray-400">
                            · {new Date(etapa.fechaFin).toLocaleDateString("es-CL")}
                          </span>
                        )}
                        {etapa.slaVencido && (
                          <Badge variant="outline" className="text-xs text-red-600 border-red-200">SLA Vencido</Badge>
                        )}
                        {esActual && horasRestantes != null && (
                          <span className={`text-xs ${etapa.slaVencido ? "text-red-600" : "text-gray-500"}`}>
                            · {etapa.slaVencido ? `${horasRestantes}h vencido` : `${horasRestantes}h restantes`}
                          </span>
                        )}
                      </div>
                    </div>
                    {accesoPermitido && (esActual || etapa.estado === "completada") && (
                      <Link href={`/etapa/${proceso.id}/${etapa.numeroEtapa}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Chat general */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat General del Proceso
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {(!mensajes || mensajes.length === 0) ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No hay mensajes aún. Inicia la conversación.
              </p>
            ) : (
              mensajes.map((msg) => {
                const esMio = msg.usuarioRemitenteId === usuario?.id;
                return (
                  <div key={msg.id} className={`flex gap-2 ${esMio ? "flex-row-reverse" : ""}`}>
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className={`max-w-[80%] ${esMio ? "items-end" : "items-start"} flex flex-col`}>
                      <div className={`flex items-center gap-2 mb-1 ${esMio ? "flex-row-reverse" : ""}`}>
                        <span className="text-xs font-medium text-gray-600">{msg.nombreRemitente || msg.rolRemitente}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.fechaMensaje).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className={`p-3 rounded-lg text-sm ${
                        esMio
                          ? "bg-red-600 text-white rounded-tr-none"
                          : "bg-gray-100 text-gray-800 rounded-tl-none"
                      }`}>
                        {msg.contenido}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendMensaje} className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Escribe un mensaje..."
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              className="bg-red-600 hover:bg-red-700"
              disabled={sendMutation.isPending || !mensaje.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
