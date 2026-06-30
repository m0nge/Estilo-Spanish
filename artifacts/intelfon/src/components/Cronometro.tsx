import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CronometroProps {
  fechaInicio: Date | string | null | undefined;
  slaHoras: number;
  label?: string;
  compact?: boolean;
}

function pad(n: number) { return String(Math.abs(Math.floor(n))).padStart(2, "0"); }

export default function Cronometro({ fechaInicio, slaHoras, label, compact = false }: CronometroProps) {
  const [elapsed, setElapsed] = useState({ h: 0, m: 0, s: 0 });
  const [slaVencido, setSlaVencido] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!fechaInicio) return;
    const start = new Date(fechaInicio).getTime();
    const slaMs = slaHoras * 3600000;

    const update = () => {
      const diff = Date.now() - start;
      const vencido = diff > slaMs;
      const display = vencido ? diff - slaMs : slaMs - diff;
      setSlaVencido(vencido);
      setPct(Math.min(100, (diff / slaMs) * 100));
      setElapsed({
        h: Math.floor(display / 3600000),
        m: Math.floor((display % 3600000) / 60000),
        s: Math.floor((display % 60000) / 1000),
      });
    };

    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [fechaInicio, slaHoras]);

  if (!fechaInicio) return null;

  const color = slaVencido ? "text-red-600" : pct >= 80 ? "text-amber-500" : "text-green-600";
  const bgColor = slaVencido ? "bg-red-50 border-red-200" : pct >= 80 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200";
  const barColor = slaVencido ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-green-500";
  const emoji = slaVencido ? "🔴" : pct >= 80 ? "🟡" : "🟢";

  if (compact) {
    return (
      <span className={`font-mono text-sm font-bold ${color}`}>
        {emoji} {slaVencido ? "+" : ""}{pad(elapsed.h)}:{pad(elapsed.m)}:{pad(elapsed.s)}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {label ?? "Tiempo transcurrido"}
        </span>
        <span className={`font-mono font-bold text-lg tracking-widest ${color}`}>
          {slaVencido && <span className="text-xs mr-1">+</span>}
          {pad(elapsed.h)}:{pad(elapsed.m)}:{pad(elapsed.s)}
        </span>
      </div>
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        <span>{slaVencido ? `🔴 SLA vencido` : `${emoji} ${Math.round(pct)}% del SLA`}</span>
        <span>SLA: {slaHoras}h</span>
      </div>
    </div>
  );
}
