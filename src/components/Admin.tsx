import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, ApiError, type Participante, type Resultado, type ResumenAdmin } from '../api';
import Encabezado from './Encabezado';
import Revision from './Revision';
import { PorArea, Veredicto } from './Resultado';

const fecha = (s: string | null) => s ? new Date(s).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const minutos = (a: string | null, b: string | null) => a && b ? `${Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 60000))} min` : '—';

type EstadoFiltro = 'todos' | 'aprobado' | 'reprobado' | 'EN_CURSO' | 'sin' | 'nunca';

function estadoDe(p: Participante, minimo: number): { clave: Exclude<EstadoFiltro, 'todos'>; texto: string } {
  if (p.estado === 'EN_CURSO') return { clave: 'EN_CURSO', texto: 'En curso' };
  if (p.estado === 'FINALIZADO') return (p.porcentaje ?? 0) >= minimo
    ? { clave: 'aprobado', texto: 'Aprobado' } : { clave: 'reprobado', texto: 'Reprobado' };
  if (p.ultimoIngreso) return { clave: 'sin', texto: 'Ingresó, sin iniciar' };
  return { clave: 'nunca', texto: 'No ha ingresado' };
}

export default function Admin({ onSalir }: { onSalir: () => void }) {
  const [datos, setDatos] = useState<ResumenAdmin | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<EstadoFiltro>('todos');
  const [detalle, setDetalle] = useState<(Resultado & { alias: string }) | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      setDatos(await adminApi.resumen());
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return onSalir();
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar');
    } finally { setCargando(false); }
  }, [onSalir]);

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresco automático cada 30 s mientras no se esté viendo un detalle
  useEffect(() => {
    if (detalle) return;
    const id = setInterval(() => cargar(), 30_000);
    return () => clearInterval(id);
  }, [detalle, cargar]);

  const minimo = datos?.config.porcentajeAprobacion ?? 70;
  const filas = useMemo(() => (datos?.participantes ?? []).filter((p) =>
    p.alias.toLowerCase().includes(buscar.trim().toLowerCase()) &&
    (filtro === 'todos' || estadoDe(p, minimo).clave === filtro)), [datos, buscar, filtro, minimo]);

  const verDetalle = async (p: Participante) => {
    if (!p.intentoId || p.estado !== 'FINALIZADO') return;
    try { setDetalle(await adminApi.detalle(p.intentoId)); window.scrollTo(0, 0); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo cargar el detalle'); }
  };

  const barra = (
    <>
      <a className="btn btn-fantasma btn-sm" href={adminApi.urlCsv()}>Descargar CSV</a>
      <button className="btn btn-fantasma btn-sm" onClick={onSalir}>Salir</button>
    </>
  );

  // ---------- Detalle de un participante ----------
  if (detalle) {
    return (
      <div className="pagina">
        <Encabezado nombre="Administración" derecha={barra} />
        <main className="contenedor estrecho">
          <button className="btn btn-secundario volver" onClick={() => setDetalle(null)}>Volver al listado</button>
          <Veredicto r={detalle} titulo={`Usuario ${detalle.alias}`} />
          <PorArea r={detalle} />
          <Revision items={detalle.revision} />
        </main>
      </div>
    );
  }

  // ---------- Listado ----------
  const t = datos?.totales;
  return (
    <div className="pagina">
      <Encabezado nombre="Administración" derecha={barra} />
      <main className="contenedor">
        <div className="admin-cab">
          <div>
            <h2>Histórico del simulacro</h2>
            <p>Se actualiza solo cada 30 segundos. Abre una fila terminada para ver sus respuestas.</p>
          </div>
          <button className="btn btn-secundario btn-sm" onClick={() => cargar()} disabled={cargando}>
            {cargando ? 'Actualizando…' : 'Actualizar ahora'}
          </button>
        </div>

        {t && (
          <dl className="datos kpis">
            <div><dt>Ingresaron</dt><dd>{t.ingresaron} <small>de {t.participantes}</small></dd></div>
            <div><dt>Terminaron</dt><dd>{t.finalizados}</dd></div>
            <div><dt>En curso</dt><dd>{t.enCurso}</dd></div>
            <div><dt>No han ingresado</dt><dd>{t.noIngresaron}</dd></div>
            <div><dt>Aprobados</dt><dd>{t.aprobados}{t.finalizados ? <small> / {t.finalizados}</small> : null}</dd></div>
            <div><dt>Promedio</dt><dd>{t.promedio === null ? '—' : `${t.promedio.toFixed(1)}%`}</dd></div>
          </dl>
        )}

        {error && <div className="alerta alerta-error">{error}</div>}

        <section className="panel">
          <div className="admin-filtros">
            <input className="buscador" placeholder="Buscar usuario…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as EstadoFiltro)}>
              <option value="todos">Todos los estados</option>
              <option value="aprobado">Aprobados</option>
              <option value="reprobado">Reprobados</option>
              <option value="EN_CURSO">En curso</option>
              <option value="sin">Ingresó, sin iniciar</option>
              <option value="nunca">No ha ingresado</option>
            </select>
          </div>

          <div className="tabla-scroll">
            <table className="tabla admin-tabla">
              <thead>
                <tr><th>Usuario</th><th>Último ingreso</th><th>Estado</th><th>Respondidas</th><th>Aciertos</th><th>Nota</th><th>Duración</th><th /></tr>
              </thead>
              <tbody>
                {filas.map((p) => {
                  const e = estadoDe(p, minimo);
                  return (
                    <tr key={p.alias} className={p.estado === 'FINALIZADO' ? 'clic' : ''} onClick={() => verDetalle(p)}>
                      <td><strong>{p.alias}</strong></td>
                      <td>{fecha(p.ultimoIngreso)}{p.ingresos > 1 && <span className="ayuda"> ({p.ingresos} veces)</span>}</td>
                      <td><span className={`badge badge-${e.clave}`}>{e.texto}</span></td>
                      <td>{p.estado ? `${p.respondidas}${p.total ? ` de ${p.total}` : ''}` : '—'}</td>
                      <td>{p.correctas === null ? '—' : `${p.correctas} de ${p.total}`}</td>
                      <td className={p.porcentaje === null ? '' : p.porcentaje >= minimo ? 'ok' : 'mal'}>
                        {p.porcentaje === null ? '—' : `${p.porcentaje.toFixed(0)}%`}
                      </td>
                      <td>{minutos(p.iniciadoEn, p.finalizadoEn)}</td>
                      <td>{p.estado === 'FINALIZADO' && <button className="ver" onClick={(ev) => { ev.stopPropagation(); verDetalle(p); }}>Ver respuestas</button>}</td>
                    </tr>
                  );
                })}
                {filas.length === 0 && <tr><td colSpan={8} className="vacio">{buscar || filtro !== 'todos' ? 'Ningún usuario con ese filtro.' : 'No hay usuarios configurados. Agrega la variable USUARIOS en Vercel.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
