import { useState, useEffect } from "react";
import { useListProcesos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Radio } from "lucide-react";
import { Link } from "wouter";

const FASE_NOMBRES_CORTO = [
  "", "Docs.", "STR", "Config.", "Armado", "Entrega"
];
const FASE_NOMBRES_COMPLETO = [
  "", "Documentación y Digitalización", "STR y Despacho",
  "Configuración de Dispositivos", "Armado y Configuración Física", "Entrega y Capacitación"
];

function getEtapaColor(estado: string, slaVencido: boolean | null) {
  if (estado === "completada") return { ring: "bg-green-500", line: "bg-green-400", text: "text-green-600" };
  if (estado === "activa") {
    if (slaVencido) return { ring: "bg-red-600", line: "bg-red-200", text: "text-red-600" };
    return { ring: "bg-amber-400", line: "bg-amber-200", text: "text-amber-600" };
  }
  return { ring: "bg-gray-200", line: "bg-gray-100", text: "text-gray-400" };
}

function useElapsed(fechaInicio: string | Date | null) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!fechaInicio) return;
    const start = new Date(fechaInicio).getTime();
    const update = () => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [fechaInicio]);

  return elapsed;
}

interface TrackingWidgetProps {
  procesoId?: number;
}

export default function TrackingWidget({ procesoId: initialId }: TrackingWidgetProps) {
  const { data: procesos = [] } = useListProcesos();
  const [selectedId, setSelectedId] = useState<string>(initialId ? String(initialId) : "");

  const proceso = procesos.find((p) => String(p.id) === selectedId);
  const etapas = (proceso as any)?.etapas as any[] | undefined;
  const etapaActual = proceso?.etapaActual ?? 1;
  const etapaActiva = etapas?.find((e: any) => e.estado === "activa");
  const elapsed = useElapsed(proceso?.fechaInicio ?? null);

  const SLA_PCT = proceso
    ? Math.max(0, Math.min(100, ((proceso as any).minutosRestantes ?? 0) / ((proceso?.slaGlobalHoras ?? 120) * 60) * 100))
    : 0;
  const slaColor = proceso?.slaVencido
    ? "text-red-600"
    : SLA_PCT < 20
    ? "text-amber-500"
    : "text-green-600";

  if (procesos.length === 0) return null;

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Radio className="h-4 w-4 text-red-600" />
          Seguimiento en Tiempo Real
        </CardTitle>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-56 h-8 text-xs">
            <SelectValue placeholder="Seleccionar orden..." />
          </SelectTrigger>
          <SelectContent>
            {procesos.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                <span className="font-mono">{p.numeroPreoferta}</span>
                <span className="text-gray-400 ml-2 text-xs">{p.clienteNombre}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="pt-0">
        {!selectedId ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            Selecciona un número de orden para ver el progreso
          </div>
        ) : !proceso ? (
          <div className="py-6 text-center text-gray-400 text-sm">Proceso no encontrado</div>
        ) : (
          <div className="space-y-4">
            {/* Info bar */}
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{proceso.clienteNombre}</span>
                <Badge variant="outline" className="font-mono text-[10px]">{proceso.numeroPreoferta}</Badge>
                {proceso.slaVencido && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">SLA Vencido</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {elapsed && (
                  <span className="font-mono text-xs text-gray-500">
                    ⏱ {elapsed}
                  </span>
                )}
                {proceso.estadoActual === "completado" && (
                  <span className="text-green-600 font-semibold text-xs">✅ Completado</span>
                )}
              </div>
            </div>

            {/* Rail tracker */}
            <div className="relative py-4">
              {/* Background track */}
              <div className="absolute top-[50%] left-[10%] right-[10%] h-1.5 bg-gray-100 rounded-full -translate-y-1/2" />

              {/* Progress fill */}
              {proceso.estadoActual !== "en_espera" && (
                <div
                  className="absolute top-[50%] left-[10%] h-1.5 rounded-full -translate-y-1/2 transition-all duration-700"
                  style={{
                    width: `${((etapaActual - 1) / 4) * 80}%`,
                    background: proceso.slaVencido
                      ? "linear-gradient(90deg, #16a34a, #dc2626)"
                      : "linear-gradient(90deg, #16a34a, #facc15)",
                  }}
                />
              )}

              {/* Nodes */}
              <div className="relative flex justify-between items-center px-[10%]">
                {[1, 2, 3, 4, 5].map((num) => {
                  const etapa = etapas?.find((e: any) => e.numeroEtapa === num);
                  const isActive = etapa?.estado === "activa";
                  const isCompleted = etapa?.estado === "completada";
                  const colors = getEtapaColor(etapa?.estado ?? "pendiente", etapa?.slaVencido ?? null);

                  return (
                    <div key={num} className="flex flex-col items-center gap-1.5 z-10">
                      {/* Node */}
                      <div className="relative">
                        {isActive && (
                          <>
                            <div className={`absolute inset-0 rounded-full ${colors.ring} opacity-30 animate-ping`} />
                            <div className={`absolute inset-0 scale-150 rounded-full ${colors.ring} opacity-10`} />
                          </>
                        )}
                        <div
                          className={`relative h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCompleted
                              ? "bg-green-500 border-green-400"
                              : isActive
                              ? `${colors.ring} border-white shadow-lg`
                              : "bg-white border-gray-200"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          ) : (
                            <span className={`text-xs font-bold ${isActive ? "text-white" : "text-gray-300"}`}>
                              {num}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Label */}
                      <span className={`text-[10px] font-medium text-center leading-tight w-12 ${
                        isActive ? colors.text + " font-semibold" : isCompleted ? "text-green-600" : "text-gray-300"
                      }`}>
                        {FASE_NOMBRES_CORTO[num]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current phase detail */}
            {etapaActiva && (
              <div className={`rounded-lg p-3 text-xs border ${
                etapaActiva.slaVencido
                  ? "bg-red-50 border-red-200"
                  : etapaActiva.minutosRestantes != null && etapaActiva.minutosRestantes < etapaActiva.slaEtapaHoras * 60 * 0.2
                  ? "bg-amber-50 border-amber-200"
                  : "bg-blue-50 border-blue-100"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">
                    Etapa {etapaActiva.numeroEtapa}: {etapaActiva.nombreEtapa || FASE_NOMBRES_COMPLETO[etapaActiva.numeroEtapa]}
                  </span>
                  {etapaActiva.minutosRestantes != null && (
                    <span className={`font-mono font-semibold ${
                      etapaActiva.slaVencido ? "text-red-600" :
                      etapaActiva.minutosRestantes < etapaActiva.slaEtapaHoras * 60 * 0.2 ? "text-amber-600" :
                      "text-green-600"
                    }`}>
                      {etapaActiva.slaVencido
                        ? `🔴 Vencido ${Math.abs(Math.round(etapaActiva.minutosRestantes / 60))}h`
                        : etapaActiva.minutosRestantes < etapaActiva.slaEtapaHoras * 60 * 0.2
                        ? `🟡 ${Math.round(etapaActiva.minutosRestantes / 60)}h restantes`
                        : `🟢 ${Math.round(etapaActiva.minutosRestantes / 60)}h restantes`}
                    </span>
                  )}
                </div>
              </div>
            )}

            <Link href={`/tracking/${proceso.id}`}>
              <div className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer text-right">
                Ver detalle completo →
              </div>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
