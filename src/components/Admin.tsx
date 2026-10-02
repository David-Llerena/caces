import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminApi, ApiError,
  type Evento, type IntentoAdmin, type Participante, type Resultado, type ResumenAdmin, type UsuarioAdmin,
} from '../api';
import Encabezado from './Encabezado';
import Revision from './Revision';
import { PorArea, Veredicto } from './Resultado';

// ---------- Formatos ----------
const fechaHora = (s: string | null) =>
  s ? new Date(s).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const hora = (s: string) => new Date(s).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
const dia = (s: string) => {
  const d = new Date(s), hoy = new Date(), ayer = new Date(Date.now() - 864e5);
  const igual = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (igual(d, hoy)) return 'Hoy';
  if (igual(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
};
const minutos = (a: string | null, b: string | null) =>
  a && b ? `${Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 60000))} min` : '—';
const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(0)}%`);

type EstadoFiltro = 'todos' | 'aprobado' | 'reprobado' | 'EN_CURSO' | 'sin' | 'nunca';

function estadoDe(p: Participante, minimo: number): { clave: Exclude<EstadoFiltro, 'todos'>; texto: string } {
  if (p.estado === 'EN_CURSO') return { clave: 'EN_CURSO', texto: 'Rindiendo ahora' };
  if (p.estado === 'FINALIZADO') return (p.porcentaje ?? 0) >= minimo
    ? { clave: 'aprobado', texto: 'Último: aprobado' } : { clave: 'reprobado', texto: 'Último: reprobado' };
  if (p.ultimoIngreso) return { clave: 'sin', texto: 'Ingresó, sin intentos' };
  return { clave: 'nunca', texto: 'No ha ingresado' };
}

// ---------- Línea de tiempo ----------
function LineaTiempo({ eventos, mostrarUsuario, minimo, onVerIntento }: {
  eventos: Evento[]; mostrarUsuario: boolean; minimo: number; onVerIntento: (id: number) => void;
}) {
  if (eventos.length === 0) return <p className="vacio">Todavía no hay actividad.</p>;
  const grupos: { dia: string; eventos: Evento[] }[] = [];
  for (const e of eventos) {
    const d = dia(e.fecha);
    if (grupos[grupos.length - 1]?.dia !== d) grupos.push({ dia: d, eventos: [] });
    grupos[grupos.length - 1].eventos.push(e);
  }
  return (
    <div className="timeline">
      {grupos.map((g) => (
        <section key={g.dia}>
          <h4 className="timeline-dia">{g.dia}</h4>
          <ol>
            {g.eventos.map((e, i) => {
              const quien = mostrarUsuario ? <strong>{e.alias} </strong> : null;
              const aprobado = (e.porcentaje ?? 0) >= minimo;
              return (
                <li key={`${e.tipo}-${e.fecha}-${i}`}
                    className={`evento evento-${e.tipo}${e.tipo === 'fin' ? (aprobado ? ' aprobado' : ' reprobado') : ''}`}>
                  <time dateTime={e.fecha}>{hora(e.fecha)}</time>
                  <span className="evento-punto" aria-hidden />
                  <div className="evento-texto">
                    {e.tipo === 'ingreso' && <>{quien}ingresó al simulacro</>}
                    {e.tipo === 'inicio' && <>{quien}empezó el intento {e.numero}</>}
                    {e.tipo === 'fin' && (
                      <>
                        {quien}terminó el intento {e.numero} con <b className={aprobado ? 'ok' : 'mal'}>{pct(e.porcentaje)}</b>
                        {e.detalle && <span className="ayuda"> ({e.detalle} correctas)</span>}
                        {e.porTiempo && <span className="tag-tiempo">se acabó el tiempo</span>}
                        {e.intentoId && <button className="ver" onClick={() => onVerIntento(e.intentoId!)}>Ver respuestas</button>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

// ---------- Tabla de intentos de un usuario ----------
function TablaIntentos({ intentos, minimo, onVer }: { intentos: IntentoAdmin[]; minimo: number; onVer: (id: number) => void }) {
  if (intentos.length === 0) return <p className="vacio">Este usuario todavía no ha hecho ningún intento.</p>;
  return (
    <div className="tabla-scroll">
      <table className="tabla admin-tabla">
        <thead>
          <tr><th>Intento</th><th>Empezó</th><th>Terminó</th><th>Duración</th><th>Respondidas</th><th>Aciertos</th><th>Nota</th><th /></tr>
        </thead>
        <tbody>
          {intentos.map((i) => (
            <tr key={i.id} className={i.estado === 'FINALIZADO' ? 'clic' : ''} onClick={() => i.estado === 'FINALIZADO' && onVer(i.id)}>
              <td><strong>N.º {i.numero}</strong></td>
              <td>{fechaHora(i.iniciadoEn)}</td>
              <td>
                {i.estado === 'EN_CURSO' ? <span className="badge badge-EN_CURSO">En curso</span> : fechaHora(i.finalizadoEn)}
                {i.porTiempo && <span className="tag-tiempo">por tiempo</span>}
              </td>
              <td>{minutos(i.iniciadoEn, i.finalizadoEn)}</td>
              <td>{i.respondidas} de {i.totalPreguntas}</td>
              <td>{i.correctas ?? '—'}</td>
              <td className={i.porcentaje === null ? '' : i.porcentaje >= minimo ? 'ok' : 'mal'}>{pct(i.porcentaje)}</td>
              <td>{i.estado === 'FINALIZADO' && <button className="ver" onClick={(ev) => { ev.stopPropagation(); onVer(i.id); }}>Ver respuestas</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'usuario'; alias: string }
  | { tipo: 'intento'; id: number; volverA: Vista };

export default function Admin({ onSalir }: { onSalir: () => void }) {
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [datos, setDatos] = useState<ResumenAdmin | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [usuario, setUsuario] = useState<UsuarioAdmin | null>(null);
  const [detalle, setDetalle] = useState<(Resultado & { alias: string }) | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<EstadoFiltro>('todos');

  const fallo = useCallback((e: unknown) => {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return onSalir();
    setError(e instanceof ApiError ? e.message : 'No se pudo cargar. Revisa tu conexión.');
  }, [onSalir]);

  const cargarLista = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [r, ev] = await Promise.all([adminApi.resumen(), adminApi.actividad()]);
      setDatos(r); setEventos(ev);
    } catch (e) { fallo(e); } finally { setCargando(false); }
  }, [fallo]);

  const cargarUsuario = useCallback(async (alias: string) => {
    setCargando(true); setError('');
    try { setUsuario(await adminApi.usuario(alias)); } catch (e) { fallo(e); } finally { setCargando(false); }
  }, [fallo]);

  // Cargar según la vista y refrescar cada 30 s (no mientras se ven respuestas)
  useEffect(() => {
    if (vista.tipo === 'intento') return;
    const cargar = vista.tipo === 'lista' ? cargarLista : () => cargarUsuario(vista.alias);
    cargar();
    const id = setInterval(cargar, 30_000);
    return () => clearInterval(id);
  }, [vista, cargarLista, cargarUsuario]);

  const abrirUsuario = (alias: string) => { setUsuario(null); setVista({ tipo: 'usuario', alias }); window.scrollTo(0, 0); };
  const abrirIntento = async (id: number, volverA: Vista) => {
    setError('');
    try { setDetalle(await adminApi.detalle(id)); setVista({ tipo: 'intento', id, volverA }); window.scrollTo(0, 0); }
    catch (e) { fallo(e); }
  };

  const minimo = datos?.config.porcentajeAprobacion ?? usuario?.porcentajeAprobacion ?? 70;
  const filas = useMemo(() => (datos?.participantes ?? []).filter((p) =>
    p.alias.toLowerCase().includes(buscar.trim().toLowerCase()) &&
    (filtro === 'todos' || estadoDe(p, minimo).clave === filtro)), [datos, buscar, filtro, minimo]);

  const barra = (
    <>
      <a className="btn btn-fantasma btn-sm" href={adminApi.urlCsv()}>Descargar CSV</a>
      <button className="btn btn-fantasma btn-sm" onClick={onSalir}>Salir</button>
    </>
  );
  const botonActualizar = (accion: () => void) => (
    <button className="btn btn-secundario btn-sm" onClick={accion} disabled={cargando}>
      {cargando ? 'Actualizando…' : 'Actualizar ahora'}
    </button>
  );

  // ---------- Respuestas de un intento ----------
  if (vista.tipo === 'intento' && detalle) {
    return (
      <div className="pagina">
        <Encabezado nombre="Administración" derecha={barra} />
        <main className="contenedor estrecho">
          <button className="btn btn-secundario volver" onClick={() => setVista(vista.volverA)}>
            {vista.volverA.tipo === 'usuario' ? `Volver a ${detalle.alias}` : 'Volver al panel'}
          </button>
          <Veredicto r={detalle} titulo={`Intento ${detalle.numero} de ${detalle.alias}`} />
          <PorArea r={detalle} />
          <Revision items={detalle.revision} />
        </main>
      </div>
    );
  }

  // ---------- Histórico de un usuario ----------
  if (vista.tipo === 'usuario') {
    const u = usuario?.usuario;
    const fin = usuario?.intentos.filter((i) => i.estado === 'FINALIZADO') ?? [];
    const promedio = fin.length ? fin.reduce((s, i) => s + (i.porcentaje ?? 0), 0) / fin.length : null;
    const volverAqui: Vista = { tipo: 'usuario', alias: vista.alias };
    return (
      <div className="pagina">
        <Encabezado nombre="Administración" derecha={barra} />
        <main className="contenedor admin-usuario">
          <button className="btn btn-secundario volver" onClick={() => setVista({ tipo: 'lista' })}>Volver al panel</button>
          <div className="admin-cab">
            <div>
              <h2>{vista.alias}</h2>
              <p>{u?.ultimoIngreso ? `Último ingreso: ${fechaHora(u.ultimoIngreso)}` : 'Todavía no ha ingresado.'}</p>
            </div>
            {botonActualizar(() => cargarUsuario(vista.alias))}
          </div>
          {error && <div className="alerta alerta-error">{error}</div>}
          {!usuario ? <div className="spinner" /> : (
            <>
              <dl className="datos kpis">
                <div><dt>Veces que ingresó</dt><dd>{u?.ingresos ?? 0}</dd></div>
                <div><dt>Intentos</dt><dd>{usuario.intentos.length}</dd></div>
                <div><dt>Mejor nota</dt><dd>{pct(u?.mejorNota ?? null)}</dd></div>
                <div><dt>Promedio</dt><dd>{promedio === null ? '—' : `${promedio.toFixed(1)}%`}</dd></div>
                <div><dt>Aprobados</dt><dd>{fin.filter((i) => (i.porcentaje ?? 0) >= minimo).length} <small>de {fin.length}</small></dd></div>
              </dl>
              <section className="panel">
                <h3>Todos sus intentos</h3>
                <TablaIntentos intentos={usuario.intentos} minimo={minimo} onVer={(id) => abrirIntento(id, volverAqui)} />
              </section>
              <section className="panel">
                <h3>Actividad por hora</h3>
                <LineaTiempo eventos={usuario.actividad} mostrarUsuario={false} minimo={minimo}
                             onVerIntento={(id) => abrirIntento(id, volverAqui)} />
              </section>
            </>
          )}
        </main>
      </div>
    );
  }

  // ---------- Panel general ----------
  const t = datos?.totales;
  return (
    <div className="pagina">
      <Encabezado nombre="Administración" derecha={barra} />
      <main className="contenedor">
        <div className="admin-cab">
          <div>
            <h2>Histórico del simulacro</h2>
            <p>Se actualiza solo cada 30 segundos. Abre un usuario para ver todos sus intentos y su actividad.</p>
          </div>
          {botonActualizar(cargarLista)}
        </div>

        {t && (
          <dl className="datos kpis">
            <div><dt>Ingresaron</dt><dd>{t.ingresaron} <small>de {t.participantes}</small></dd></div>
            <div><dt>Rindiendo ahora</dt><dd>{t.enCurso}</dd></div>
            <div><dt>Con intentos terminados</dt><dd>{t.finalizados}</dd></div>
            <div><dt>Aprobaron su último intento</dt><dd>{t.aprobados}{t.finalizados ? <small> de {t.finalizados}</small> : null}</dd></div>
            <div><dt>Promedio del último intento</dt><dd>{t.promedio === null ? '—' : `${t.promedio.toFixed(1)}%`}</dd></div>
          </dl>
        )}

        {error && <div className="alerta alerta-error">{error}</div>}

        <section className="panel">
          <div className="admin-filtros">
            <input className="buscador" placeholder="Buscar usuario…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as EstadoFiltro)}>
              <option value="todos">Todos los estados</option>
              <option value="EN_CURSO">Rindiendo ahora</option>
              <option value="aprobado">Último intento aprobado</option>
              <option value="reprobado">Último intento reprobado</option>
              <option value="sin">Ingresó, sin intentos</option>
              <option value="nunca">No ha ingresado</option>
            </select>
          </div>
          <div className="tabla-scroll">
            <table className="tabla admin-tabla">
              <thead>
                <tr><th>Usuario</th><th>Último ingreso</th><th>Estado</th><th>Intentos</th><th>Última nota</th><th>Mejor nota</th><th /></tr>
              </thead>
              <tbody>
                {filas.map((p) => {
                  const e = estadoDe(p, minimo);
                  return (
                    <tr key={p.alias} className="clic" onClick={() => abrirUsuario(p.alias)}>
                      <td><strong>{p.alias}</strong></td>
                      <td>{fechaHora(p.ultimoIngreso)}{p.ingresos > 1 && <span className="ayuda"> ({p.ingresos} veces)</span>}</td>
                      <td><span className={`badge badge-${e.clave}`}>{e.texto}</span></td>
                      <td>{p.intentos}</td>
                      <td className={p.porcentaje === null ? '' : p.porcentaje >= minimo ? 'ok' : 'mal'}>{pct(p.porcentaje)}</td>
                      <td>{pct(p.mejorNota)}</td>
                      <td><button className="ver" onClick={(ev) => { ev.stopPropagation(); abrirUsuario(p.alias); }}>Ver histórico</button></td>
                    </tr>
                  );
                })}
                {filas.length === 0 && (
                  <tr><td colSpan={7} className="vacio">
                    {buscar || filtro !== 'todos' ? 'Ningún usuario con ese filtro.' : 'No hay usuarios configurados. Agrega la variable USUARIOS en Vercel.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel actividad-general">
          <h3>Actividad reciente</h3>
          <LineaTiempo eventos={eventos} mostrarUsuario minimo={minimo} onVerIntento={(id) => abrirIntento(id, { tipo: 'lista' })} />
        </section>
      </main>
    </div>
  );
}
