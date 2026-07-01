import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Image as ImageIcon, X, User } from "lucide-react";

interface Mensaje {
  id: number;
  usuarioRemitenteId: number;
  contenido: string;
  imagenBase64?: string | null;
  fechaMensaje: Date | string;
  nombreRemitente?: string;
  rolRemitente?: string;
}

interface MencionUsuario {
  id: number;
  nombre: string;
}

interface ChatBoxProps {
  mensajes: Mensaje[];
  usuarioId?: number;
  isPending: boolean;
  onSend: (contenido: string, imagenBase64?: string) => void;
  placeholder?: string;
  maxHeight?: string;
  usuarios?: MencionUsuario[];
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function resaltarMenciones(texto: string) {
  const partes = texto.split(/(@\S+)/g);
  return partes.map((p, i) =>
    p.startsWith("@")
      ? <span key={i} className="text-yellow-300 font-semibold">{p}</span>
      : <span key={i}>{p}</span>
  );
}

export default function ChatBox({
  mensajes,
  usuarioId,
  isPending,
  onSend,
  placeholder = "Escribe un mensaje... usa @nombre para mencionar",
  maxHeight = "max-h-64",
  usuarios = [],
}: ChatBoxProps) {
  const [mensaje, setMensaje] = useState("");
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [mencionSugg, setMencionSugg] = useState<MencionUsuario[]>([]);
  const [mencionQuery, setMencionQuery] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [mensajes.length]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("La imagen no puede superar 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setImagenPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleTextoChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMensaje(val);

    // Detectar @menciones
    const match = val.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMencionQuery(q);
      setMencionSugg(
        usuarios.filter(u => u.nombre.toLowerCase().includes(q)).slice(0, 5)
      );
    } else {
      setMencionSugg([]);
      setMencionQuery(null);
    }
  }, [usuarios]);

  const insertarMencion = useCallback((u: MencionUsuario) => {
    setMensaje(prev => prev.replace(/@(\w*)$/, `@${u.nombre.split(" ")[0]} `));
    setMencionSugg([]);
    setMencionQuery(null);
  }, []);

  const handleSend = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim() && !imagenPreview) return;
    onSend(mensaje.trim(), imagenPreview ?? undefined);
    setMensaje("");
    setImagenPreview(null);
    setMencionSugg([]);
  }, [mensaje, imagenPreview, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!mensaje.trim() && !imagenPreview) return;
      onSend(mensaje.trim(), imagenPreview ?? undefined);
      setMensaje("");
      setImagenPreview(null);
      setMencionSugg([]);
    }
  };

  return (
    <div className="space-y-3">
      <ScrollArea className={`${maxHeight} pr-1`}>
        <div ref={scrollRef} className="space-y-3">
          {mensajes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No hay mensajes aún.</p>
          ) : (
            mensajes.map((msg) => {
              const esMio = msg.usuarioRemitenteId === usuarioId;
              return (
                <div key={msg.id} className={`flex gap-2 ${esMio ? "flex-row-reverse" : ""}`}>
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className={`max-w-[80%] flex flex-col ${esMio ? "items-end" : "items-start"}`}>
                    <div className={`flex items-center gap-1.5 mb-0.5 ${esMio ? "flex-row-reverse" : ""}`}>
                      <span className="text-xs font-medium text-gray-600">{msg.nombreRemitente || msg.rolRemitente}</span>
                      <span className="text-xs text-gray-400">{formatTime(msg.fechaMensaje)}</span>
                    </div>
                    <div className={`rounded-lg text-sm overflow-hidden ${
                      esMio ? "bg-red-600 text-white rounded-tr-none" : "bg-gray-100 text-gray-800 rounded-tl-none"
                    }`}>
                      {msg.imagenBase64 && (
                        <img
                          src={msg.imagenBase64}
                          alt="imagen adjunta"
                          className="max-w-[220px] max-h-[200px] object-contain cursor-pointer"
                          onClick={() => window.open(msg.imagenBase64!, "_blank")}
                        />
                      )}
                      {msg.contenido && (
                        <div className="px-3 py-2 whitespace-pre-wrap break-words">
                          {resaltarMenciones(msg.contenido)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {imagenPreview && (
        <div className="relative inline-block">
          <img src={imagenPreview} alt="preview" className="max-h-24 rounded-md border border-gray-200" />
          <button
            onClick={() => setImagenPreview(null)}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-700 text-white flex items-center justify-center"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Sugerencias de mención */}
      {mencionSugg.length > 0 && (
        <div className="border rounded-lg bg-white shadow-lg overflow-hidden">
          {mencionSugg.map((u) => (
            <button
              key={u.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => insertarMencion(u)}
            >
              <User className="h-4 w-4 text-gray-400" />
              <span className="font-medium">@{u.nombre}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 mb-0.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Textarea
          placeholder={placeholder}
          value={mensaje}
          onChange={handleTextoChange}
          onKeyDown={handleKeyDown}
          className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm py-2"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          className="bg-red-600 hover:bg-red-700 flex-shrink-0 mb-0.5"
          disabled={isPending || (!mensaje.trim() && !imagenPreview)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="text-xs text-gray-400">Enter para enviar · Shift+Enter nueva línea · @nombre para mencionar</p>
    </div>
  );
}
