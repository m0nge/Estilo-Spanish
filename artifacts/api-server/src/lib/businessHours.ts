/**
 * Calcula minutos de tiempo laboral transcurrido entre dos fechas.
 * Horario laboral: lunes–viernes, 08:00–17:00 (hora local del servidor).
 */
const HORA_INICIO = 8;  // 8:00 am
const HORA_FIN   = 17; // 5:00 pm

function minutosLaboralesEnDia(desde: Date, hasta: Date): number {
  // Ambas fechas deben estar en el mismo día
  const inicioLaboral = new Date(desde);
  inicioLaboral.setHours(HORA_INICIO, 0, 0, 0);
  const finLaboral = new Date(desde);
  finLaboral.setHours(HORA_FIN, 0, 0, 0);

  const efectivoDesde = new Date(Math.max(desde.getTime(), inicioLaboral.getTime()));
  const efectivoHasta = new Date(Math.min(hasta.getTime(), finLaboral.getTime()));

  if (efectivoHasta <= efectivoDesde) return 0;
  return (efectivoHasta.getTime() - efectivoDesde.getTime()) / 60000;
}

function esDiaLaboral(d: Date): boolean {
  const dow = d.getDay();
  return dow >= 1 && dow <= 5; // lunes=1 ... viernes=5
}

export function minutosLaboralesTranscurridos(inicio: Date, fin: Date = new Date()): number {
  if (fin <= inicio) return 0;
  let total = 0;
  const cursor = new Date(inicio);

  while (cursor < fin) {
    const finDia = new Date(cursor);
    finDia.setHours(23, 59, 59, 999);
    const limiteFin = fin < finDia ? fin : finDia;

    if (esDiaLaboral(cursor)) {
      total += minutosLaboralesEnDia(cursor, limiteFin);
    }

    // Avanzar al día siguiente a medianoche
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
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
