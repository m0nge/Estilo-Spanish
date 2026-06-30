import { useState } from "react";
import {
  useListUsuarios, useCreateUsuario, useUpdateUsuario, useDeleteUsuario
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2, Loader2, User } from "lucide-react";

const ROLES = ["Ventas", "Activaciones", "Bodega", "MSO", "Logistica", "Admin"];
const AREAS = ["Ventas", "Activaciones", "Bodega", "MSO", "Logistica", "Sistemas"];

const ROL_COLORS: Record<string, string> = {
  Admin: "bg-red-100 text-red-700",
  Ventas: "bg-blue-100 text-blue-700",
  Activaciones: "bg-purple-100 text-purple-700",
  Bodega: "bg-orange-100 text-orange-700",
  MSO: "bg-green-100 text-green-700",
  Logistica: "bg-yellow-100 text-yellow-700",
};

interface UsuarioForm {
  nombre: string;
  email: string;
  password: string;
  rol: string;
  area: string;
  activo: boolean;
}

const defaultForm: UsuarioForm = {
  nombre: "", email: "", password: "", rol: "Ventas", area: "Ventas", activo: true,
};

export default function AdminUsuarios() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UsuarioForm>(defaultForm);

  const { data: usuarios, isLoading, refetch } = useListUsuarios();

  const createMutation = useCreateUsuario({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usuario creado exitosamente" });
        setDialogOpen(false);
        refetch();
      },
      onError: () => toast({ title: "Error al crear usuario", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateUsuario({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usuario actualizado" });
        setDialogOpen(false);
        refetch();
      },
      onError: () => toast({ title: "Error al actualizar usuario", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteUsuario({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usuario eliminado" });
        refetch();
      },
    },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (usuario: any) => {
    setEditingId(usuario.id);
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      password: "",
      rol: usuario.rol,
      area: usuario.area,
      activo: usuario.activo,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const updateData: any = {
        nombre: form.nombre,
        email: form.email,
        rol: form.rol as any,
        area: form.area,
        activo: form.activo,
      };
      if (form.password) updateData.password = form.password;
      updateMutation.mutate({ id: editingId, data: updateData });
    } else {
      createMutation.mutate({
        data: {
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          rol: form.rol as any,
          area: form.area,
          activo: form.activo,
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
          <p className="text-sm text-gray-500 mt-0.5">Administra los usuarios del sistema y sus roles</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700" onClick={handleOpenCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(usuarios || []).map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{u.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-xs ${ROL_COLORS[u.rol] || ""}`}>{u.rol}</Badge>
                    <Badge variant="outline" className={`text-xs ${u.activo ? "text-green-600 border-green-200" : "text-gray-400"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(u)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (confirm(`¿Eliminar usuario ${u.nombre}?`)) deleteMutation.mutate({ id: u.id });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!editingId} />
            </div>
            <div className="space-y-2">
              <Label>{editingId ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editingId}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={form.area} onValueChange={(v) => setForm({ ...form, area: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingId && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.activo ? "activo" : "inactivo"} onValueChange={(v) => setForm({ ...form, activo: v === "activo" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
