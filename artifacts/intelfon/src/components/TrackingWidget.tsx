import { useState, useEffect, useRef } from "react";
import { useListProcesos } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Radio, ClipboardList, AlertCircle } from "lucide-react";
import { Link } from "wouter";

const FASE_NOMBRES_CORTO: Record<number, string> = {
  1: "Docs.", 2: "STR", 3: "Config.", 4: "Armado", 5: "Entrega"
};
const FASE_NOMBRES_COMPLETO: Record<number, string> = {
  1: "Documentación y Digitalización", 2: "STR y Despacho",
  3: "Configuración de Dispositivos", 4: "Armado y Configuración Física", 5: "Entrega y Capacitación"
};

// Antenna SVG animada
function AntennaIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      {/* Ondas animadas */}
      {active && (
        <>
          <circle cx="14" cy="14" r="10" stroke={color} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" className="animate-[spin_3s_linear_infinite]" />
          <circle cx="14" cy="14" r="6" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" className="animate-[spin_2s_linear_infinite_reverse]" />
        </>
      )}
      {/* Antena */}
      <line x1="14" y1="14" x2="14" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="4" x2="10" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="4" x2="18" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2.5" fill={color} />
      {/* Base */}
      <line x1="10" y1="22" x2="18" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="14" x2="14" y2="22" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function getEtapaColor(estado: string, slaVencido: boolean | null) {
  if (estado === "completada") return { ring: "bg-green-500", text: "text-green-600", hex: "#16a34a" };
  if (estado === "activa") {
    if (slaVencido) return { ring: "bg-red-600", text: "text-red-600", hex: "#dc2626" };
    return { ring: "bg-amber-400", text: "text-amber-600", hex: "#d97706" };
  }
  return { ring: "bg-gray-200", text: "text-gray-400", hex: "#9ca3af" };
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

// Panel de pendientes para usuarios no-admin
function PendientesPanel() {
  const { data: pendientes = [], isLoading } = useQuery<any[]>({
    queryKey: ["pendientes-area"],
    queryFn: () => customFetch<any[]>("/api/pendientes-area").catch(() => []),
    refetchInterval: 60000,
  });

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-red-600" />
          Mis Tareas Pendientes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="py-6 text-center text-gray-400 text-sm">Cargando...</div>
        ) : pendientes.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
            <p>Sin tareas pendientes en tu área</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pendientes.map((item: any) => (
              <Link key={item.id} href={`/tracking/${item.idProceso}`}>
                <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{item.descripcion}</p>
                    <p className="text-xs text-gray-400 font-mono">{item.numeroPreoferta}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TrackingWidget({ procesoId: initialId }: TrackingWidgetProps) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === "Admin";
  const { data: procesos = [] } = useListProcesos();
  const [selectedId, setSelectedId] = useState<string>(initialId ? String(initialId) : "");

  // Non-admin users see their pending tasks
  if (!isAdmin) return <PendientesPanel />;

  const proceso = procesos.find((p) => String(p.id) === selectedId);
  const etapas = (proceso as any)?.etapas as any[] | undefined;
  const etapaActual = proceso?.etapaActual ?? 1;
  const etapaActiva = etapas?.find((e: any) => e.estado === "activa");
  const elapsed = useElapsed(etapaActiva?.fechaInicio ?? null);
  const antenaColor = proceso?.slaVencido ? "#dc2626" : proceso?.estadoActual === "completado" ? "#16a34a" : "#3b82f6";

  if (procesos.length === 0) return null;

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <AntennaIcon active={!!selectedId && proceso?.estadoActual !== "completado"} color={antenaColor} />
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
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{proceso.clienteNombre}</span>
                <Badge variant="outline" className="font-mono text-[10px]">{proceso.numeroPreoferta}</Badge>
                {proceso.slaVencido && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">SLA Vencido</Badge>
                )}
              </div>
              {elapsed && (
                <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  ⏱ {elapsed}
                </span>
              )}
            </div>

            {/* Rail */}
            <div className="relative py-4">
              <div className="absolute top-[50%] left-[10%] right-[10%] h-1.5 bg-gray-100 rounded-full -translate-y-1/2" />
              {proceso.estadoActual !== "en_espera" && (
                <div
                  className="absolute top-[50%] left-[10%] h-1.5 rounded-full -translate-y-1/2 transition-all duration-700"
                  style={{
                    width: `${((etapaActual - 1) / Math.max((etapas?.length ?? 5) - 1, 1)) * 80}%`,
                    background: proceso.slaVencido
                      ? "linear-gradient(90deg, #16a34a, #dc2626)"
                      : "linear-gradient(90deg, #16a34a, #facc15)",
                  }}
                />
              )}
              <div className="relative flex justify-between items-center px-[10%]">
                {[1, 2, 3, 4, 5].map((num) => {
                  const etapa = etapas?.find((e: any) => e.numeroEtapa === num);
                  const isActive = etapa?.estado === "activa";
                  const isCompleted = etapa?.estado === "completada";
                  const colors = getEtapaColor(etapa?.estado ?? "pendiente", etapa?.slaVencido ?? null);
                  return (
                    <div key={num} className="flex flex-col items-center gap-1.5 z-10">
                      <div className="relative">
                        {isActive && (
                          <>
                            <div className={`absolute inset-0 rounded-full ${colors.ring} opacity-30 animate-ping`} />
                            <div className={`absolute inset-0 scale-150 rounded-full ${colors.ring} opacity-10`} />
                          </>
                        )}
                        <div className={`relative h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all ${
                          isCompleted ? "bg-green-500 border-green-400" :
                          isActive ? `${colors.ring} border-white shadow-lg` :
                          "bg-white border-gray-200"
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          ) : (
                            <span className={`text-xs font-bold ${isActive ? "text-white" : "text-gray-300"}`}>{num}</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight w-12 ${
                        isActive ? colors.text + " font-semibold" : isCompleted ? "text-green-600" : "text-gray-300"
                      }`}>
                        {FASE_NOMBRES_CORTO[num] ?? num}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {etapaActiva && (
              <div className={`rounded-lg p-3 text-xs border ${
                etapaActiva.slaVencido ? "bg-red-50 border-red-200" :
                etapaActiva.minutosRestantes != null && etapaActiva.minutosRestantes < etapaActiva.slaEtapaHoras * 60 * 0.2
                  ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-100"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">
                    Etapa {etapaActiva.numeroEtapa}: {etapaActiva.nombreEtapa || FASE_NOMBRES_COMPLETO[etapaActiva.numeroEtapa]}
                  </span>
                  {etapaActiva.minutosRestantes != null && (
                    <span className={`font-mono font-semibold ${
                      etapaActiva.slaVencido ? "text-red-600" :
                      etapaActiva.minutosRestantes < etapaActiva.slaEtapaHoras * 60 * 0.2 ? "text-amber-600" : "text-green-600"
                    }`}>
                      {etapaActiva.slaVencido
                        ? `🔴 ${Math.abs(Math.round(etapaActiva.minutosRestantes / 60))}h vencido`
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
