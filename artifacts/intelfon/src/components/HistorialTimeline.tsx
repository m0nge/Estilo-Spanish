import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, PlayCircle, AlertTriangle, Star,
  User, Clock, History
} from "lucide-react";

interface HistorialItem {
  tipo: string;
  etapaNumero?: number;
  fecha: string;
  titulo: string;
  descripcion: string;
  usuarioNombre?: string | null;
  usuarioRol?: string | null;
  duracionHoras?: number;
  checklistTotal?: number;
  checklistCompletados?: number;
  conJustificacion?: boolean;
  slaVencidaAlCompletar?: boolean;
  icono: string;
  color: string;
}

const COLORES: Record<string, { dot: string; line: string; bg: string; text: string }> = {
  blue:   { dot: "bg-blue-500",   line: "border-blue-200",   bg: "bg-blue-50",   text: "text-blue-700" },
  green:  { dot: "bg-green-500",  line: "border-green-200",  bg: "bg-green-50",  text: "text-green-700" },
  red:    { dot: "bg-red-500",    line: "border-red-200",    bg: "bg-red-50",    text: "text-red-700" },
  orange: { dot: "bg-orange-400", line: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700" },
  gray:   { dot: "bg-gray-400",   line: "border-gray-200",   bg: "bg-gray-50",   text: "text-gray-600" },
};

function IconFor({ tipo, color }: { tipo: string; color: string }) {
  const cls = `h-3.5 w-3.5 text-white`;
  if (tipo === "proceso_creado")   return <PlayCircle className={cls} />;
  if (tipo === "etapa_completada") return <CheckCircle2 className={cls} />;
  if (tipo === "proceso_completado") return <Star className={cls} />;
  if (tipo === "justificacion")    return <AlertTriangle className={cls} />;
  return <Clock className={`h-3 w-3 text-white`} />;
}

function formatFecha(f: string) {
  const d = new Date(f);
  return d.toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

interface Props {
  procesoId: number;
}

export default function HistorialTimeline({ procesoId }: Props) {
  const [items, setItems] = useState<HistorialItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    customFetch<HistorialItem[]>(`/api/procesos/${procesoId}/historial`)
      .then(data => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [procesoId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-red-600" />
          Historial de Auditoría
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {error ? (
          <p className="text-sm text-red-500 text-center py-4">Error cargando historial.</p>
        ) : items === null ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No hay eventos registrados aún.</p>
        ) : (
          <div className="relative">
            {/* Línea vertical */}
            <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-gray-200" />

            <div className="space-y-4">
              {items.map((item, idx) => {
                const c = COLORES[item.color] ?? COLORES.gray;
                const esUltimo = idx === items.length - 1;
                return (
                  <div key={idx} className="flex gap-3 relative">
                    {/* Dot */}
                    <div className={`relative z-10 flex-shrink-0 h-9 w-9 rounded-full ${c.dot} flex items-center justify-center shadow-sm`}>
                      <IconFor tipo={item.tipo} color={item.color} />
                    </div>

                    {/* Content */}
                    <div className={`flex-1 rounded-lg border p-3 ${c.bg} ${c.line} min-w-0`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${c.text}`}>{item.titulo}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatFecha(item.fecha)}</span>
                      </div>

                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.descripcion}</p>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {item.usuarioNombre && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <User className="h-3 w-3" />
                            {item.usuarioNombre}
                            {item.usuarioRol && <span className="text-gray-400">· {item.usuarioRol}</span>}
                          </span>
                        )}
                        {item.duracionHoras != null && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            {item.duracionHoras}h en esta etapa
                          </span>
                        )}
                        {item.checklistTotal != null && item.checklistTotal > 0 && (
                          <span className={`text-xs font-medium ${
                            item.checklistCompletados === item.checklistTotal ? "text-green-600" : "text-orange-500"
                          }`}>
                            ✓ {item.checklistCompletados}/{item.checklistTotal} checklist
                          </span>
                        )}
                        {item.conJustificacion && (
                          <span className="text-xs text-orange-500 font-medium">⚠ Justificada</span>
                        )}
                        {item.slaVencidaAlCompletar && (
                          <span className="text-xs text-red-500 font-medium">🔴 Fuera de SLA</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
