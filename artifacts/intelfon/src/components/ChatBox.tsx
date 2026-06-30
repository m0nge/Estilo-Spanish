import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ChatBoxProps {
  mensajes: Mensaje[];
  usuarioId?: number;
  isPending: boolean;
  onSend: (contenido: string, imagenBase64?: string) => void;
  placeholder?: string;
  maxHeight?: string;
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatBox({
  mensajes,
  usuarioId,
  isPending,
  onSend,
  placeholder = "Escribe un mensaje...",
  maxHeight = "max-h-64",
}: ChatBoxProps) {
  const [mensaje, setMensaje] = useState("");
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagenPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleSend = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim() && !imagenPreview) return;
    onSend(mensaje.trim(), imagenPreview ?? undefined);
    setMensaje("");
    setImagenPreview(null);
  }, [mensaje, imagenPreview, onSend]);

  return (
    <div className="space-y-3">
      <ScrollArea className={`${maxHeight} pr-1`}>
        <div className="space-y-3">
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
                      <span className="text-xs font-medium text-gray-600">
                        {msg.nombreRemitente || msg.rolRemitente}
                      </span>
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
                        <div className="px-3 py-2">{msg.contenido}</div>
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

      <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t">
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
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Input
          placeholder={placeholder}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          className="bg-red-600 hover:bg-red-700 flex-shrink-0"
          disabled={isPending || (!mensaje.trim() && !imagenPreview)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
