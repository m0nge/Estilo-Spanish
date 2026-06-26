import { useLocation } from "wouter";
import { useCreateProceso } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface FormData {
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  tipoCliente: "Nuevo" | "Existente";
  planSolicitado: string;
  cantidadEquipos: number;
  prioridad: "baja" | "media" | "alta" | "urgente";
}

export default function CrearProceso() {
  const [, navigate] = useLocation();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      tipoCliente: "Nuevo",
      prioridad: "media",
      cantidadEquipos: 1,
    },
  });

  const createMutation = useCreateProceso({
    mutation: {
      onSuccess: (proceso) => {
        navigate(`/tracking/${proceso.id}`);
      },
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({
      clienteNombre: data.clienteNombre,
      clienteEmail: data.clienteEmail || undefined,
      clienteTelefono: data.clienteTelefono || undefined,
      tipoCliente: data.tipoCliente,
      planSolicitado: data.planSolicitado,
      cantidadEquipos: data.cantidadEquipos,
      prioridad: data.prioridad,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Proceso de Activación</h2>
          <p className="text-sm text-gray-500">Registra un nuevo cliente para iniciar el workflow</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del Cliente</CardTitle>
          <CardDescription>Información para identificar el proceso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {createMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Error al crear el proceso. Por favor intenta nuevamente.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="clienteNombre">
                  Nombre del Cliente <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="clienteNombre"
                  placeholder="Nombre completo o razón social"
                  {...register("clienteNombre", { required: "El nombre es obligatorio" })}
                  className={errors.clienteNombre ? "border-red-400" : ""}
                />
                {errors.clienteNombre && (
                  <p className="text-xs text-red-500">{errors.clienteNombre.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clienteEmail">Email del Cliente</Label>
                <Input
                  id="clienteEmail"
                  type="email"
                  placeholder="cliente@empresa.com"
                  {...register("clienteEmail")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clienteTelefono">Teléfono</Label>
                <Input
                  id="clienteTelefono"
                  placeholder="+56 9 1234 5678"
                  {...register("clienteTelefono")}
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="planSolicitado">
                  Plan Solicitado <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="planSolicitado"
                  placeholder="Ej: Plan Empresarial 100Mbps, Pack 5 equipos..."
                  {...register("planSolicitado", { required: "El plan es obligatorio" })}
                  className={errors.planSolicitado ? "border-red-400" : ""}
                />
                {errors.planSolicitado && (
                  <p className="text-xs text-red-500">{errors.planSolicitado.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo de Cliente</Label>
                <Select
                  defaultValue="Nuevo"
                  onValueChange={(v) => setValue("tipoCliente", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nuevo">Nuevo Cliente</SelectItem>
                    <SelectItem value="Existente">Cliente Existente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  defaultValue="media"
                  onValueChange={(v) => setValue("prioridad", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgente">🔴 Urgente</SelectItem>
                    <SelectItem value="alta">🟠 Alta</SelectItem>
                    <SelectItem value="media">🟡 Media</SelectItem>
                    <SelectItem value="baja">🟢 Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidadEquipos">Cantidad de Equipos</Label>
                <Input
                  id="cantidadEquipos"
                  type="number"
                  min={1}
                  {...register("cantidadEquipos", { valueAsNumber: true, min: 1 })}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/dashboard" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancelar
                </Button>
              </Link>
              <Button
                type="submit"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Proceso"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
