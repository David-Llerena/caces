import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type IntentoData, type Resultado, type Sesion } from '../api';
import Encabezado from './Encabezado';

interface Props {
  sesion: Sesion;
  intento: IntentoData;
  onFinalizado: (r: Resultado) => void;
  onSesionExpirada: () => void;
}

type EstadoGuardado = 'ok' | 'guardando' | 'error';

const formatoTiempo = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const dd = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${dd(m)}:${dd(s)}` : `${dd(m)}:${dd(s)}`;
};

export default function Examen({ sesion, intento, onFinalizado, onSesionExpirada }: Props) {
  const { preguntas, intentoId } = intento;
  const claveMarcas = `simulacro.marcas.${intentoId}`;

  const [actual, setActual] = useState(() => {
    // Reanuda en la primera pregunta sin responder
    const i = preguntas.findIndex((p) => !intento.respuestas[p.id]);
    return i === -1 ? 0 : i;
  });
  const [respuestas, setRespuestas] = useState<Record<number, number>>(intento.respuestas);
  const [marcadas, setMarcadas] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem(claveMarcas) ?? '[]')); } catch { return new Set(); }
  });
  const [guardado, setGuardado] = useState<EstadoGuardado>('ok');
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [navAbierta, setNavAbierta] = useState(false);

  // Reloj sincronizado con el servidor (el cliente no decide la hora)
  const desfase = useMemo(() => new Date(intento.ahoraServidor).getTime() - Date.now(), [intento]);
  const expira = new Date(intento.expiraEn).getTime();
  const [restante, setRestante] = useState(expira - (Date.now() + desfase));
  const duracionMs = Math.max(1, expira - new Date(intento.iniciadoEn).getTime());

  const pendientes = useRef(new Set<Promise<unknown>>());
  const finalizando = useRef(false);

  const finalizar = useCallback(async () => {
    if (finalizando.current) return;
    finalizando.current = true;
    setEnviando(true); setConfirmar(false);
    await Promise.allSettled([...pendientes.current]);
    try {
      const r = await api.enviar(intentoId);
      try { sessionStorage.removeItem(claveMarcas); } catch { /* */ }
      onFinalizado(r);
    } catch (e) {
      finalizando.current = false; setEnviando(false);
      if (e instanceof ApiError && e.status === 401) return onSesionExpirada();
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar. Intenta de nuevo.');
    }
  }, [intentoId, claveMarcas, onFinalizado, onSesionExpirada]);

  useEffect(() => {
    const id = setInterval(() => {
      const r = expira - (Date.now() + desfase);
      setRestante(r);
      if (r <= 0) finalizar();
    }, 1000);
    return () => clearInterval(id);
  }, [expira, desfase, finalizar]);

  // Aviso si intenta cerrar la pestaña
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (!finalizando.current) e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(claveMarcas, JSON.stringify([...marcadas])); } catch { /* */ }
  }, [marcadas, claveMarcas]);

  const guardar = useCallback((preguntaId: number, opcionId: number | null) => {
    setGuardado('guardando');
    const tarea = (async () => {
      for (let intento = 0; intento < 4; intento++) {
        try {
          await api.responder(intentoId, preguntaId, opcionId);
          setGuardado('ok'); setError('');
          return;
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) return onSesionExpirada();
          if (e instanceof ApiError && e.status === 409) { setTimeout(finalizar, 0); return; } // tiempo agotado
          if (e instanceof ApiError && e.status === 400) { setGuardado('error'); setError(e.message); return; }
          await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
        }
      }
      setGuardado('error');
      setError('No se pudo guardar tu última respuesta. Revisa tu conexión y vuelve a seleccionarla.');
    })();
    pendientes.current.add(tarea);
    tarea.finally(() => pendientes.current.delete(tarea));
  }, [intentoId, finalizar, onSesionExpirada]);

  const p = preguntas[actual];

  const elegir = useCallback((opcionId: number) => {
    if (enviando) return;
    const nueva = respuestas[p.id] === opcionId ? null : opcionId; // clic de nuevo = desmarcar
    setRespuestas((r) => {
      const copia = { ...r };
      if (nueva === null) delete copia[p.id]; else copia[p.id] = nueva;
      return copia;
    });
    guardar(p.id, nueva);
  }, [p, respuestas, guardar, enviando]);

  const toggleMarca = () => setMarcadas((s) => {
    const n = new Set(s);
    if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
    return n;
  });

  const ir = (i: number) => { setActual(Math.max(0, Math.min(preguntas.length - 1, i))); setNavAbierta(false); };

  // Atajos: A–E elige, flechas navegan
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (confirmar || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') ir(actual + 1);
      else if (e.key === 'ArrowLeft') ir(actual - 1);
      else {
        const o = p.opciones.find((o) => o.letra.toLowerCase() === e.key.toLowerCase());
        if (o) elegir(o.id);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const respondidas = Object.keys(respuestas).length;
  const sinResponder = preguntas.length - respondidas;
  const critico = restante < 5 * 60 * 1000;

  return (
    <div className="pagina examen">
      <Encabezado
        nombre={sesion.estudiante.alias}
        derecha={
          <div className={`reloj ${critico ? 'critico' : ''}`} role="timer" aria-live="off">
            <span className="reloj-etiqueta">Tiempo restante</span>
            <span className="reloj-valor">{formatoTiempo(restante)}</span>
          </div>
        }
      />

      <div className={`barra-tiempo ${critico ? 'critico' : ''}`} aria-hidden>
        <div style={{ width: `${Math.max(0, Math.min(100, (restante / duracionMs) * 100))}%` }} />
      </div>

      <div className="examen-cuerpo">
        <main className="examen-principal">
          <div className="pregunta-meta">
            <span>Pregunta <strong>{actual + 1}</strong> de {preguntas.length}</span>
            <span className="chip">{p.area}</span>
            <span className={`estado-guardado ${guardado}`} aria-live="polite">
              {guardado === 'guardando' ? 'Guardando…' : guardado === 'error' ? 'Sin guardar' : 'Guardado'}
            </span>
          </div>

          <article className="panel pregunta" key={p.id}>
            <p className="enunciado">{p.enunciado}</p>
            <div className="opciones" role="radiogroup" aria-label="Opciones">
              {p.opciones.map((o) => {
                const sel = respuestas[p.id] === o.id;
                return (
                  <button key={o.id} role="radio" aria-checked={sel}
                          className={`opcion ${sel ? 'seleccionada' : ''}`}
                          onClick={() => elegir(o.id)} disabled={enviando}>
                    <span className="opcion-letra">{o.letra}</span>
                    <span className="opcion-texto">{o.texto}</span>
                  </button>
                );
              })}
            </div>
          </article>

          {error && <div className="alerta alerta-error" role="alert">{error}</div>}

          <div className="examen-acciones">
            <button className={`btn btn-marca ${marcadas.has(p.id) ? 'activa' : ''}`} onClick={toggleMarca} aria-pressed={marcadas.has(p.id)}>
              {marcadas.has(p.id) ? 'Marcada para revisar' : 'Marcar para revisar'}
            </button>
            <button className="btn btn-secundario" onClick={() => ir(actual - 1)} disabled={actual === 0}>Anterior</button>
            {actual < preguntas.length - 1
              ? <button className="btn btn-primario" onClick={() => ir(actual + 1)}>Siguiente</button>
              : <button className="btn btn-primario" onClick={() => setConfirmar(true)} disabled={enviando}>Finalizar examen</button>}
          </div>
          <p className="ayuda atajos">Atajos de teclado: <kbd>A</kbd>–<kbd>{p.opciones[p.opciones.length - 1]?.letra}</kbd> para responder, <kbd>←</kbd> <kbd>→</kbd> para cambiar de pregunta.</p>
        </main>

        <aside className={`navegador ${navAbierta ? 'abierto' : ''}`}>
          <button className="navegador-toggle" onClick={() => setNavAbierta((v) => !v)}>
            <span>{respondidas} de {preguntas.length} respondidas</span><span>{navAbierta ? 'Cerrar' : 'Ver preguntas'}</span>
          </button>
          <div className="navegador-panel">
            <div className="navegador-cab"><h3>Preguntas</h3><span>{respondidas} de {preguntas.length}</span></div>
            <div className="rejilla">
              {preguntas.map((q, i) => (
                <button key={q.id}
                        className={['celda', respuestas[q.id] && 'respondida', marcadas.has(q.id) && 'marcada', i === actual && 'actual'].filter(Boolean).join(' ')}
                        onClick={() => ir(i)} aria-label={`Ir a pregunta ${i + 1}`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <ul className="leyenda">
              <li><span className="celda respondida" /> Respondida</li>
              <li><span className="celda" /> Sin responder</li>
              <li><span className="celda marcada" /> Marcada</li>
            </ul>
            <button className="btn btn-primario btn-bloque" onClick={() => setConfirmar(true)} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Finalizar examen'}
            </button>
          </div>
        </aside>
      </div>

      {confirmar && (
        <div className="modal-fondo" onClick={() => setConfirmar(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>¿Finalizar el examen?</h3>
            <p>{sinResponder ? `Te quedan ${sinResponder} preguntas sin responder. ` : ''}Una vez enviado no podrás cambiar tus respuestas.</p>
            <dl className="datos compacto">
              <div><dt>Respondidas</dt><dd>{respondidas}</dd></div>
              <div><dt>Sin responder</dt><dd className={sinResponder ? 'mal' : ''}>{sinResponder}</dd></div>
              <div><dt>Marcadas</dt><dd>{marcadas.size}</dd></div>
              <div><dt>Tiempo</dt><dd>{formatoTiempo(restante)}</dd></div>
            </dl>
            <div className="modal-acciones">
              <button className="btn btn-secundario" onClick={() => setConfirmar(false)}>Seguir revisando</button>
              <button className="btn btn-primario" onClick={finalizar}>Enviar examen</button>
            </div>
          </div>
        </div>
      )}

      {enviando && (
        <div className="modal-fondo">
          <div className="modal centro"><div className="spinner" /><p>Enviando y calificando…</p></div>
        </div>
      )}
    </div>
  );
}
