/**
 * Calcula minutos de tiempo laboral transcurrido entre dos fechas.
 * Horario laboral: lunes–viernes, 08:00–17:00 (hora El Salvador, UTC-6, sin horario de verano).
 */
const HORA_INICIO = 8;   // 8:00 am El Salvador
const HORA_FIN   = 17;  // 5:00 pm El Salvador
// El Salvador es UTC-6. Para obtener hora local: UTC - 6h
// Se trabaja con "fake-local": desplazamos el timestamp -6h y usamos métodos getUTC*
const TZ_OFFSET_MS = 6 * 3_600_000; // 6 horas en ms

/** Convierte un Date UTC a uno donde getUTC* devuelve la hora de El Salvador */
function utcToLocal(d: Date): Date {
  return new Date(d.getTime() - TZ_OFFSET_MS);
}

/** Convierte ese "Date local" de vuelta a UTC real */
function localToUtc(d: Date): Date {
  return new Date(d.getTime() + TZ_OFFSET_MS);
}

function minutosLaboralesEnDia(desdeUTC: Date, hastaUTC: Date): number {
  const desdeLocal = utcToLocal(desdeUTC);

  const inicioLaboralLocal = new Date(desdeLocal);
  inicioLaboralLocal.setUTCHours(HORA_INICIO, 0, 0, 0);
  const finLaboralLocal = new Date(desdeLocal);
  finLaboralLocal.setUTCHours(HORA_FIN, 0, 0, 0);

  const inicioLaboralUTC = localToUtc(inicioLaboralLocal);
  const finLaboralUTC    = localToUtc(finLaboralLocal);

  const efectivoDesde = new Date(Math.max(desdeUTC.getTime(), inicioLaboralUTC.getTime()));
  const efectivoHasta = new Date(Math.min(hastaUTC.getTime(), finLaboralUTC.getTime()));

  if (efectivoHasta <= efectivoDesde) return 0;
  return (efectivoHasta.getTime() - efectivoDesde.getTime()) / 60000;
}

function esDiaLaboral(d: Date): boolean {
  const local = utcToLocal(d);
  const dow = local.getUTCDay(); // día de semana en tiempo local El Salvador
  return dow >= 1 && dow <= 5;  // lunes=1 ... viernes=5
}

export function minutosLaboralesTranscurridos(inicio: Date, fin: Date = new Date()): number {
  if (fin <= inicio) return 0;
  let total = 0;

  let cursorLocal = utcToLocal(inicio);
  const finLocal  = utcToLocal(fin);

  while (true) {
    const finDiaLocal = new Date(cursorLocal);
    finDiaLocal.setUTCHours(23, 59, 59, 999);
    const limiteFinLocal = finLocal < finDiaLocal ? finLocal : finDiaLocal;

    if (esDiaLaboral(localToUtc(cursorLocal))) {
      total += minutosLaboralesEnDia(localToUtc(cursorLocal), localToUtc(limiteFinLocal));
    }

    if (limiteFinLocal.getTime() >= finLocal.getTime()) break;

    // Avanzar al día siguiente en tiempo local El Salvador
    cursorLocal = new Date(finDiaLocal);
    cursorLocal.setUTCDate(cursorLocal.getUTCDate() + 1);
    cursorLocal.setUTCHours(0, 0, 0, 0);
  }

  return Math.round(total);
}

export function calcularSlaVencidoLaboral(fechaInicio: Date | string, slaHoras: number): boolean {
  const inicio = new Date(fechaInicio);
  const minutosUsados = minutosLaboralesTranscurridos(inicio);
  return minutosUsados > slaHoras * 60;
}

export function calcularMinutosRestantesLaboral(fechaInicio: Date | string, slaHoras: number): number {
  const inicio = new Date(fechaInicio);
  const minutosUsados = minutosLaboralesTranscurridos(inicio);
  return slaHoras * 60 - minutosUsados; // negativo = vencido
}
