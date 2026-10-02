import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { adminApi, ApiError, type Participante, type Resultado, type ResumenAdmin } from '../api';
import Encabezado from './Encabezado';
import Revision from './Revision';
import { PorArea, Veredicto } from './Resultado';
import { Pulso } from './Iconos';

const CLAVE = 'simulacro.admin';
const leer = () => { try { return sessionStorage.getItem(CLAVE) ?? ''; } catch { return ''; } };
const escribir = (v: string) => { try { v ? sessionStorage.setItem(CLAVE, v) : sessionStorage.removeItem(CLAVE); } catch { /* */ } };

const fecha = (s: string | null) => s ? new Date(s).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const minutos = (a: string | null, b: string | null) => a && b ? `${Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 60000))} min` : '—';

type EstadoFiltro = 'todos' | 'aprobado' | 'reprobado' | 'EN_CURSO' | 'sin';

function estadoDe(p: Participante, minimo: number): { clave: Exclude<EstadoFiltro, 'todos'>; texto: string } {
  if (p.estado === 'EN_CURSO') return { clave: 'EN_CURSO', texto: 'En curso' };
  if (p.estado === 'FINALIZADO') return (p.porcentaje ?? 0) >= minimo
    ? { clave: 'aprobado', texto: 'Aprobado' } : { clave: 'reprobado', texto: 'Reprobado' };
  return { clave: 'sin', texto: 'Sin iniciar' };
}

export default function Admin() {
  const [clave, setClave] = useState(leer());
  const [entrada, setEntrada] = useState('');
  const [datos, setDatos] = useState<ResumenAdmin | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<EstadoFiltro>('todos');
  const [detalle, setDetalle] = useState<(Resultado & { alias: string }) | null>(null);

  const cargar = useCallback(async (k = clave) => {
    if (!k) return;
    setCargando(true); setError('');
    try {
      setDatos(await adminApi.resumen(k));
      setClave(k); escribir(k);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setClave(''); escribir(''); }
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar');
    } finally { setCargando(false); }
  }, [clave]);

  useEffect(() => { if (clave) cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresco automático cada 30 s mientras no se esté viendo un detalle
  useEffect(() => {
    if (!clave || detalle) return;
    const id = setInterval(() => cargar(), 30_000);
    return () => clearInterval(id);
  }, [clave, detalle, cargar]);

  const minimo = datos?.config.porcentajeAprobacion ?? 70;
  const filas = useMemo(() => (datos?.participantes ?? []).filter((p) =>
    p.alias.toLowerCase().includes(buscar.trim().toLowerCase()) &&
    (filtro === 'todos' || estadoDe(p, minimo).clave === filtro)), [datos, buscar, filtro, minimo]);

  const verDetalle = async (p: Participante) => {
    if (!p.intentoId || p.estado !== 'FINALIZADO') return;
    try { setDetalle(await adminApi.detalle(clave, p.intentoId)); window.scrollTo(0, 0); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo cargar el detalle'); }
  };

  const salir = () => { escribir(''); setClave(''); setDatos(null); setDetalle(null); };

  // ---------- Pantalla de clave ----------
  if (!clave || (!datos && !cargando && error)) {
    const enviar = (e: FormEvent) => { e.preventDefault(); cargar(entrada.trim()); };
    return (
      <div className="login">
        <section className="login-portada">
          <p className="login-institucion">Administración</p>
          <div>
            <h1 className="login-titulo">Histórico del simulacro</h1>
            <p className="login-bajada">Quién ingresó, quién terminó y qué respondió cada uno.</p>
          </div>
          <Pulso size={40} />
        </section>
        <section className="login-form">
          <form onSubmit={enviar}>
            <h2>Clave de administrador</h2>
            <label className="campo">
              Clave
              <input type="password" autoFocus value={entrada} onChange={(e) => setEntrada(e.target.value)} required />
            </label>
            {error && <div className="alerta alerta-error" role="alert">{error}</div>}
            <button className="btn btn-primario btn-bloque" disabled={cargando}>{cargando ? 'Verificando…' : 'Ver histórico'}</button>
          </form>
        </section>
      </div>
    );
  }

  const barra = (
    <>
      <a className="btn btn-fantasma btn-sm" href={adminApi.urlCsv(clave)}>Descargar CSV</a>
      <button className="btn btn-fantasma btn-sm" onClick={salir}>Salir</button>
    </>
  );

  // ---------- Detalle de un participante ----------
  if (detalle) {
    return (
      <div className="pagina">
        <Encabezado nombre="Administración" derecha={barra} />
        <main className="contenedor estrecho">
          <button className="btn btn-secundario volver" onClick={() => setDetalle(null)}>Volver al listado</button>
          <Veredicto r={detalle} titulo={`Alias ${detalle.alias}`} />
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
            <div><dt>Ingresaron</dt><dd>{t.participantes}</dd></div>
            <div><dt>Terminaron</dt><dd>{t.finalizados}</dd></div>
            <div><dt>En curso</dt><dd>{t.enCurso}</dd></div>
            <div><dt>Sin iniciar</dt><dd>{t.sinIniciar}</dd></div>
            <div><dt>Aprobados</dt><dd>{t.aprobados}{t.finalizados ? <small> / {t.finalizados}</small> : null}</dd></div>
            <div><dt>Promedio</dt><dd>{t.promedio === null ? '—' : `${t.promedio.toFixed(1)}%`}</dd></div>
          </dl>
        )}

        {error && <div className="alerta alerta-error">{error}</div>}

        <section className="panel">
          <div className="admin-filtros">
            <input className="buscador" placeholder="Buscar alias…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as EstadoFiltro)}>
              <option value="todos">Todos los estados</option>
              <option value="aprobado">Aprobados</option>
              <option value="reprobado">Reprobados</option>
              <option value="EN_CURSO">En curso</option>
              <option value="sin">Sin iniciar</option>
            </select>
          </div>

          <div className="tabla-scroll">
            <table className="tabla admin-tabla">
              <thead>
                <tr><th>Alias</th><th>Ingresó</th><th>Estado</th><th>Respondidas</th><th>Aciertos</th><th>Nota</th><th>Duración</th><th /></tr>
              </thead>
              <tbody>
                {filas.map((p) => {
                  const e = estadoDe(p, minimo);
                  return (
                    <tr key={p.id} className={p.estado === 'FINALIZADO' ? 'clic' : ''} onClick={() => verDetalle(p)}>
                      <td><strong>{p.alias}</strong></td>
                      <td>{fecha(p.creadoEn)}</td>
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
                {filas.length === 0 && <tr><td colSpan={8} className="vacio">Sin participantes{buscar || filtro !== 'todos' ? ' con ese filtro' : ' todavía'}.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
