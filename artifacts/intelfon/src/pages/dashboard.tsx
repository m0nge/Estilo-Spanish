import { useState } from "react";
import { Link } from "wouter";
import { useListProcesos, useGetDashboardStats } from "@workspace/api-client-react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, CheckCircle2, PlusCircle, Search, ChevronRight, ArrowUpCircle } from "lucide-react";

const FASE_NOMBRES = [
  "", "Documentación y Digitalización", "STR y Despacho",
  "Configuración de Dispositivos", "Armado y Configuración Física", "Entrega y Capacitación"
];

const ESTADO_LABELS: Record<string, string> = {
  en_espera: "En Espera",
  en_fase_1: "Etapa 1",
  en_fase_2: "Etapa 2",
  en_fase_3: "Etapa 3",
  en_fase_4: "Etapa 4",
  en_fase_5: "Etapa 5",
  completado: "Completado",
};

const ESTADO_COLORS: Record<string, string> = {
  en_espera: "bg-gray-100 text-gray-600 border-gray-200",
  en_fase_1: "bg-blue-100 text-blue-700 border-blue-200",
  en_fase_2: "bg-blue-100 text-blue-700 border-blue-200",
  en_fase_3: "bg-purple-100 text-purple-700 border-purple-200",
  en_fase_4: "bg-orange-100 text-orange-700 border-orange-200",
  en_fase_5: "bg-yellow-100 text-yellow-700 border-yellow-200",
  completado: "bg-green-100 text-green-700 border-green-200",
};

const PRIORIDAD_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  urgente: "bg-red-200 text-red-800",
  media: "bg-orange-100 text-orange-700",
  baja: "bg-gray-100 text-gray-600",
};

export default function Dashboard() {
  const { usuario } = useAuth();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: procesos, isLoading: procesosLoading } = useListProcesos(
    filtroEstado !== "todos" ? { estado: filtroEstado } : undefined
  );

  const procesosFiltrados = (procesos || []).filter((p) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return p.clienteNombre.toLowerCase().includes(q) ||
      p.numeroPreoferta.toLowerCase().includes(q);
  });

  const canCrear = usuario?.rol === "Admin" || usuario?.rol === "Ventas";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Bienvenido, {usuario?.nombre} · {usuario?.area}
          </p>
        </div>
        {canCrear && (
          <Link href="/procesos/crear">
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Proceso
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-8 w-8 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats?.enProgreso ?? 0}</p>
                    <p className="text-xs text-gray-500">En Proceso</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats?.vencidos ?? 0}</p>
                    <p className="text-xs text-gray-500">SLA Vencido</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats?.completados ?? 0}</p>
                    <p className="text-xs text-gray-500">Completados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-400">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <ArrowUpCircle className="h-8 w-8 text-orange-400 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats?.urgentes ?? 0}</p>
                    <p className="text-xs text-gray-500">Urgentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Fase distribution */}
      {stats?.porFase && stats.porFase.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Distribución por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {stats.porFase.map((f) => (
                <div key={f.fase} className="text-center">
                  <div className="text-lg font-bold text-red-600">{f.cantidad}</div>
                  <div className="text-xs text-gray-500 leading-tight">
                    {FASE_NOMBRES[f.fase]?.split(" ").slice(0, 2).join(" ")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por cliente o código..."
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Process List */}
      <div className="space-y-3">
        {procesosLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-20" /></CardContent></Card>
          ))
        ) : procesosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              {busqueda || filtroEstado !== "todos"
                ? "No se encontraron procesos con los filtros aplicados."
                : "No hay procesos registrados. Crea el primero usando el botón de arriba."}
            </CardContent>
          </Card>
        ) : (
          procesosFiltrados.map((proceso) => (
            <Link key={proceso.id} href={`/tracking/${proceso.id}`}>
              <Card
                className="hover:shadow-md transition-shadow cursor-pointer border-l-4"
                style={{
                  borderLeftColor: proceso.slaVencido ? "#DC2626"
                    : proceso.prioridad === "alta" || proceso.prioridad === "urgente" ? "#F97316"
                    : "#E5E7EB"
                }}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">{proceso.clienteNombre}</span>
                        {(proceso.prioridad === "alta" || proceso.prioridad === "urgente") && (
                          <ArrowUpCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        )}
                        <Badge variant="outline" className={`text-xs ${ESTADO_COLORS[proceso.estadoActual] || ""}`}>
                          {ESTADO_LABELS[proceso.estadoActual] || proceso.estadoActual}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${PRIORIDAD_COLORS[proceso.prioridad] || ""}`}>
                          {proceso.prioridad}
                        </Badge>
                        {proceso.slaVencido && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                            SLA Vencido
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400 font-mono">{proceso.numeroPreoferta}</span>
                      </div>
                      {proceso.etapaActual && (
                        <p className="text-xs text-gray-500 mt-1">
                          Etapa {proceso.etapaActual}: {FASE_NOMBRES[proceso.etapaActual]}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
