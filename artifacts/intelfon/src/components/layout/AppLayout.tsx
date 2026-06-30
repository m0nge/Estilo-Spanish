import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../../contexts/AuthContext";
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  Users, 
  Clock, 
  BarChart, 
  LogOut, 
  Menu,
  Bell,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent } from "../ui/sheet";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import logoUrl from "@assets/image_1782498618865.png";
import { useLogout, useListNotificaciones, useMarcarNotificacionLeida, useMarcarTodasLeidas } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface AppLayoutProps {
  children: ReactNode;
}

const TIPO_ICONOS: Record<string, ReactNode> = {
  etapa_lista: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  sla_proximo: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  sla_vencido: <AlertCircle className="h-4 w-4 text-red-600" />,
  chat_nuevo: <MessageSquare className="h-4 w-4 text-blue-500" />,
  comentario_nuevo: <MessageSquare className="h-4 w-4 text-blue-500" />,
  documento_faltante: <AlertCircle className="h-4 w-4 text-orange-500" />,
};

export default function AppLayout({ children }: AppLayoutProps) {
  const { usuario, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const logoutMutation = useLogout();

  const { data: notificaciones = [], refetch: refetchNotifs } = useListNotificaciones({
    query: { refetchInterval: 10000 },
  });

  const marcarLeidaMutation = useMarcarNotificacionLeida();
  const marcarTodasLeidasMutation = useMarcarTodasLeidas({
    mutation: { onSuccess: () => refetchNotifs() },
  });

  const noLeidas = notificaciones.filter(n => !n.leido).length;

  const handleMarcarLeida = (id: number) => {
    marcarLeidaMutation.mutate({ id }, { onSuccess: () => refetchNotifs() });
  };

  const handleClickNotif = (notif: { id: number; leido: boolean; idProceso?: number | null }) => {
    if (!notif.leido) handleMarcarLeida(notif.id);
    if (notif.idProceso) {
      setNotifOpen(false);
      navigate(`/tracking/${notif.idProceso}`);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, { onSuccess: () => logout() });
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ...(usuario?.rol === "Admin" || usuario?.rol === "Ventas" 
      ? [{ label: "Nuevo Proceso", href: "/procesos/crear", icon: PlusCircle }] 
      : []),
    ...(usuario?.rol === "Admin" 
      ? [
          { label: "Reportes SLA", href: "/admin/reportes", icon: BarChart },
          { label: "Config. Etapas", href: "/admin/etapas", icon: Settings },
          { label: "Usuarios", href: "/admin/usuarios", icon: Users },
          { label: "SLA Global", href: "/admin/sla", icon: Clock },
        ] 
      : [])
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-6 flex items-center justify-center border-b border-sidebar-border">
        <img src={logoUrl} alt="RED Intelfon" className="h-12 w-auto" />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center">
          <Avatar className="h-9 w-9 bg-sidebar-primary text-sidebar-primary-foreground">
            <AvatarFallback>{usuario?.nombre?.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="ml-3">
            <p className="text-sm font-medium text-sidebar-foreground">{usuario?.nombre}</p>
            <p className="text-xs text-sidebar-foreground/70">{usuario?.rol}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0 md:w-64">
        <SidebarContent />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border z-10 shadow-sm">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-2"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground tracking-tight hidden sm:block">
              Workflow de Activaciones
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notifications Bell */}
            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                  <Bell className="h-5 w-5" />
                  {noLeidas > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {noLeidas > 9 ? "9+" : noLeidas}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0" forceMount>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold text-gray-900">
                    Notificaciones
                    {noLeidas > 0 && (
                      <Badge className="ml-2 bg-red-100 text-red-700 text-[10px] hover:bg-red-100 border-0">
                        {noLeidas} sin leer
                      </Badge>
                    )}
                  </span>
                  {noLeidas > 0 && (
                    <button
                      onClick={() => marcarTodasLeidasMutation.mutate()}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Marcar todas leídas
                    </button>
                  )}
                </div>

                {/* List */}
                {notificaciones.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Sin notificaciones</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    {notificaciones.map((notif) => (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                          !notif.leido ? "bg-red-50/50" : ""
                        }`}
                        onClick={() => handleClickNotif(notif)}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {TIPO_ICONOS[notif.tipo] ?? <Bell className="h-4 w-4 text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-tight ${!notif.leido ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                            {notif.titulo}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.mensaje}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(notif.fechaCreacion), { addSuffix: true, locale: es })}
                          </p>
                        </div>
                        {!notif.leido && (
                          <div className="flex-shrink-0 mt-1.5">
                            <div className="h-2 w-2 rounded-full bg-red-600" />
                          </div>
                        )}
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                    <AvatarFallback>{usuario?.nombre?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{usuario?.nombre}</p>
                    <p className="text-xs leading-none text-muted-foreground">{usuario?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 focus:outline-none">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
