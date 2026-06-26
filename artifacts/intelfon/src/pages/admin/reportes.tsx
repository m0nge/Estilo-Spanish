import { useGetReporteSla, useGetReporteProcesos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { BarChart2, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";

const FASE_NOMBRES = [
  "", "Documentación", "STR y Despacho",
  "Config. Dispositivos", "Armado Físico", "Entrega"
];

export default function AdminReportes() {
  const { data: reporteSla, isLoading: slaLoading } = useGetReporteSla();
  const { data: reporteProcesos, isLoading: procesosLoading } = useGetReporteProcesos();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reportes y Métricas</h2>
        <p className="text-sm text-gray-500 mt-0.5">Análisis de cumplimiento SLA y rendimiento del workflow</p>
      </div>

      {/* SLA Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slaLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20" /></CardContent></Card>
          ))
        ) : reporteSla ? (
          <>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{reporteSla.totalCompletados}</p>
                    <p className="text-xs text-gray-500">Total Completados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{reporteSla.totalEnProgreso}</p>
                    <p className="text-xs text-gray-500">En Progreso</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{reporteSla.totalVencidos ?? 0}</p>
                    <p className="text-xs text-gray-500">SLA Vencidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="md:col-span-3">
            <CardContent className="py-8 text-center text-gray-400">
              No hay datos de SLA disponibles.
            </CardContent>
          </Card>
        )}
      </div>

      {/* SLA por Etapa */}
      {reporteSla?.cumplimientoPorEtapa && reporteSla.cumplimientoPorEtapa.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-red-600" />
              Cumplimiento SLA por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reporteSla.cumplimientoPorEtapa.map((etapa) => {
              const total = etapa.cumplidos + etapa.vencidos;
              const porcentaje = etapa.porcentajeCumplimiento ?? (total > 0 ? (etapa.cumplidos / total) * 100 : 100);
              return (
                <div key={etapa.etapa} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Etapa {etapa.etapa}: {etapa.nombre || FASE_NOMBRES[etapa.etapa]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {etapa.cumplidos}/{total} procesos
                      </span>
                      <Badge
                        variant="outline"
                        className={porcentaje >= 80
                          ? "text-green-600 border-green-200"
                          : porcentaje >= 60
                            ? "text-orange-500 border-orange-200"
                            : "text-red-600 border-red-200"
                        }
                      >
                        {porcentaje.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={porcentaje} className="h-2" />
                  {etapa.vencidos > 0 && (
                    <p className="text-xs text-red-500">{etapa.vencidos} proceso(s) con SLA vencido</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Promedio de tiempo por etapa */}
      {reporteSla?.promedioTiempoPorEtapa && reporteSla.promedioTiempoPorEtapa.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Tiempo Promedio por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {reporteSla.promedioTiempoPorEtapa.map((e) => (
                <div key={e.etapa} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">{FASE_NOMBRES[e.etapa]}</p>
                  <p className="text-lg font-bold text-gray-900">{e.promedioHoras.toFixed(1)}h</p>
                  <p className="text-xs text-gray-400">promedio</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Procesos Metrics */}
      {procesosLoading ? (
        <Card><CardContent className="pt-4"><Skeleton className="h-48" /></CardContent></Card>
      ) : reporteProcesos && reporteProcesos.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-600" />
              Procesos — Métricas Detalladas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase">
                    <th className="text-left pb-2 font-medium">Cliente</th>
                    <th className="text-left pb-2 font-medium">Código</th>
                    <th className="text-left pb-2 font-medium">Estado</th>
                    <th className="text-right pb-2 font-medium">Horas</th>
                    <th className="text-right pb-2 font-medium">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reporteProcesos.slice(0, 20).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-900 truncate max-w-[150px]">{p.clienteNombre}</td>
                      <td className="py-2 text-gray-500 font-mono text-xs">{p.numeroPreoferta}</td>
                      <td className="py-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${p.estadoActual === "completado" ? "text-green-600 border-green-200" :
                            p.slaVencido ? "text-red-600 border-red-200" : "text-blue-600 border-blue-200"
                          }`}
                        >
                          {p.estadoActual}
                        </Badge>
                      </td>
                      <td className="py-2 text-right text-gray-700">
                        {p.horasTranscurridas != null ? `${p.horasTranscurridas.toFixed(1)}h` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {p.estadoActual === "completado" ? (
                          p.slaVencido
                            ? <span className="text-red-600 text-xs">✗ Vencido</span>
                            : <span className="text-green-600 text-xs">✓ Cumplido</span>
                        ) : (
                          <span className={`text-xs ${p.slaVencido ? "text-red-600" : "text-gray-400"}`}>
                            {p.slaVencido ? "⚠ Vencido" : "En curso"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
