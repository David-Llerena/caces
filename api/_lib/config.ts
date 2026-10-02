// Configuración del simulacro (variables de entorno en Vercel)
export const VERSION = 'v6-admin-tolerante';

/** Limpia valores pegados con comillas, espacios o con "NOMBRE=" adelante */
function limpio(nombre: string): string {
  return (process.env[nombre] ?? '')
    .trim()
    .replace(new RegExp(`^${nombre}\\s*=\\s*`, 'i'), '')
    .replace(/^["'](.*)["']$/s, '$1')
    .trim();
}
function num(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== '' && process.env[name] !== undefined ? v : def;
}

export const config = {
  get duracionMinutos() { return num('DURACION_MINUTOS', 60); },
  /** 0 (o vacío) = intentos ilimitados */
  get maxIntentos() { return Math.max(0, num('MAX_INTENTOS', 0)); },
  get intentosIlimitados() { return this.maxIntentos === 0; },
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
  get adminKey() { return limpio('ADMIN_KEY'); },
  get adminUsuario() { return limpio('ADMIN_USUARIO') || 'admin'; },
  /**
   * Usuarios habilitados: USUARIOS="usuario1:clave1,usuario2:clave2"
   * (también acepta ; o saltos de línea como separador)
   */
  get usuarios(): { usuario: string; clave: string }[] {
    return limpio('USUARIOS')
      .split(/[,;\n\s]+/)
      .map((par) => {
        const i = par.indexOf(':');
        return i > 0 ? { usuario: par.slice(0, i).trim(), clave: par.slice(i + 1).trim() } : null;
      })
      .filter((u): u is { usuario: string; clave: string } => !!u && u.usuario.length > 0 && u.clave.length > 0);
  },
};

/** Segundos de gracia para latencia de red al guardar/enviar */
export const GRACIA_SEGUNDOS = 10;
