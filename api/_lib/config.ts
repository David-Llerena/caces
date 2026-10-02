// Configuración del simulacro (variables de entorno en Vercel)
function num(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== '' && process.env[name] !== undefined ? v : def;
}

export const config = {
  get duracionMinutos() { return num('DURACION_MINUTOS', 60); },
  get maxIntentos() { return num('MAX_INTENTOS', 1); },
  /** 0 = todas las preguntas activas */
  get numPreguntas() { return num('NUM_PREGUNTAS', 0); },
  get porcentajeAprobacion() { return num('PORCENTAJE_APROBACION', 70); },
  get jwtSecret() {
    const s = process.env.JWT_SECRET;
    if (!s || s.length < 32) throw new Error('JWT_SECRET no configurado (mínimo 32 caracteres)');
    return new TextEncoder().encode(s);
  },
  /** Mostrar al estudiante qué preguntas tuvo bien y mal al terminar */
  get mostrarRevision() { return (process.env.MOSTRAR_REVISION ?? 'true').toLowerCase() !== 'false'; },
  get adminKey() { return process.env.ADMIN_KEY ?? ''; },
};

/** Segundos de gracia para latencia de red al guardar/enviar */
export const GRACIA_SEGUNDOS = 10;
