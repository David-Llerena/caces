// Cliente HTTP del simulacro. Mismo dominio en Vercel → sin CORS.
export interface Opcion { id: number; letra: string; texto: string }
export interface Pregunta { id: number; area: string; enunciado: string; opciones: Opcion[] }
export interface Config { duracionMinutos: number; maxIntentos: number; numPreguntas: number; porcentajeAprobacion: number }
export interface Historial { id: number; numero: number; finalizadoEn: string; correctas: number; total: number; porcentaje: number }
export interface Estado {
  config: Config;
  intentosUsados: number;
  puedeIniciar: boolean;
  intentoEnCurso: { id: number; expiraEn: string } | null;
  historial: Historial[];
}
export interface Sesion { token: string; estudiante: { alias: string } }
export interface IntentoData {
  intentoId: number; numero: number; iniciadoEn: string; expiraEn: string; ahoraServidor: string;
  preguntas: Pregunta[]; respuestas: Record<number, number>;
}
export interface Resultado {
  intentoId: number; numero: number; correctas: number; total: number; respondidas: number;
  porcentaje: number; aprobado: boolean; porcentajeAprobacion: number; duracionSegundos: number;
  porArea: { area: string; total: number; correctas: number }[];
  revision: ItemRevision[];
}
export interface ItemRevision {
  numero: number; preguntaId: number; area: string; enunciado: string;
  opciones: { id: number; letra: string; texto: string; correcta: boolean }[];
  elegida: number | null; acierto: boolean;
}
export interface Participante {
  id: number; alias: string; creadoEn: string; ip: string | null; navegador: string | null;
  intentoId: number | null; estado: 'EN_CURSO' | 'FINALIZADO' | null;
  iniciadoEn: string | null; finalizadoEn: string | null; expiraEn: string | null;
  respondidas: number; correctas: number | null; total: number | null; porcentaje: number | null;
}
export interface ResumenAdmin {
  config: { duracionMinutos: number; porcentajeAprobacion: number };
  totales: { participantes: number; enCurso: number; sinIniciar: number; finalizados: number; aprobados: number; promedio: number | null };
  participantes: Participante[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const CLAVE = 'simulacro.sesion';
export const sesionGuardada = (): Sesion | null => {
  try { return JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null'); } catch { return null; }
};
export const guardarSesion = (s: Sesion | null) => {
  try { s ? sessionStorage.setItem(CLAVE, JSON.stringify(s)) : sessionStorage.removeItem(CLAVE); } catch { /* sin storage */ }
};

let token = sesionGuardada()?.token ?? '';
export const setToken = (t: string) => { token = t; };

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api/${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisa tu internet e intenta de nuevo.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data.error ?? `Error ${r.status}`);
  return data as T;
}

const post = <T>(path: string, body?: unknown) => http<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const api = {
  ingresar: (alias: string) => post<Sesion & { estado: Estado }>('ingresar', { alias }),
  estado: () => http<Estado>('estado'),
  iniciar: () => post<IntentoData>('intento'),
  responder: (intentoId: number, preguntaId: number, opcionId: number | null) =>
    post<{ ok: true }>('respuesta', { intentoId, preguntaId, opcionId }),
  enviar: (intentoId: number) => post<Resultado>('enviar', { intentoId }),
  resultado: (id: number) => http<Resultado>(`resultado?id=${id}`),
};

export const adminApi = {
  resumen: (clave: string) => http<ResumenAdmin>('admin/resumen', { headers: { 'x-admin-key': clave } }),
  detalle: (clave: string, intento: number) =>
    http<Resultado & { alias: string }>(`admin/detalle?intento=${intento}`, { headers: { 'x-admin-key': clave } }),
  urlCsv: (clave: string) => `/api/admin/resultados?key=${encodeURIComponent(clave)}`,
};
