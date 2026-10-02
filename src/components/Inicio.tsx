import { useState } from 'react';
import { ApiError, type Estado, type Sesion } from '../api';
import Encabezado from './Encabezado';
import { Check } from './Iconos';

interface Props {
  sesion: Sesion; estado: Estado;
  onComenzar: () => Promise<void>; onVerResultado: (id: number) => Promise<void>; onSalir: () => void;
}

export default function Inicio({ sesion, estado, onComenzar, onVerResultado, onSalir }: Props) {
  const { config, intentoEnCurso, historial } = estado;
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const restantes = Math.max(0, config.maxIntentos - estado.intentosUsados);

  const comenzar = async () => {
    setCargando(true); setError('');
    try { await onComenzar(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo iniciar'); setCargando(false); }
  };

  return (
    <div className="pagina">
      <Encabezado nombre={sesion.estudiante.alias}
                  derecha={<button className="btn btn-fantasma btn-sm" onClick={onSalir}>Salir</button>} />
      <main className="contenedor estrecho">
        <div>
          <h2 className="saludo">Hola, {sesion.estudiante.alias}</h2>
          <p className="saludo-sub">Revisa las condiciones antes de empezar.</p>
        </div>

        <section className="panel">
          <dl className="datos">
            <div><dt>Preguntas</dt><dd>{config.numPreguntas}</dd></div>
            <div><dt>Tiempo</dt><dd>{config.duracionMinutos} min</dd></div>
            <div><dt>Intentos</dt><dd>{config.maxIntentos === 0 ? 'Ilimitados' : `${restantes} de ${config.maxIntentos}`}</dd></div>
            <div><dt>Para aprobar</dt><dd>{config.porcentajeAprobacion}%</dd></div>
          </dl>
          <ul className="reglas">
            <li><Check /><span>El tiempo empieza al presionar <strong>Comenzar</strong> y corre aunque cierres la página.</span></li>
            <li><Check /><span>Cada respuesta se guarda automáticamente. Si se cierra la página, vuelve a ingresar con tu usuario y continúas donde ibas.</span></li>
            <li><Check /><span>Puedes marcar preguntas para revisarlas antes de finalizar.</span></li>
            <li><Check /><span>Al acabarse el tiempo, el examen se envía solo con lo que hayas respondido.</span></li>
            <li><Check /><span>Al finalizar verás tu nota y qué preguntas tuviste bien y mal.</span></li>
          </ul>

          {error && <div className="alerta alerta-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {intentoEnCurso ? (
            <button className="btn btn-primario btn-bloque" onClick={comenzar} disabled={cargando}>
              {cargando ? 'Cargando…' : 'Continuar intento en curso'}
            </button>
          ) : estado.puedeIniciar ? (
            <button className="btn btn-primario btn-bloque" onClick={comenzar} disabled={cargando}>
              {cargando ? 'Preparando examen…' : historial.length ? 'Comenzar nuevo intento' : 'Comenzar examen'}
            </button>
          ) : (
            <div className="alerta">
              {config.numPreguntas === 0 ? 'Aún no hay preguntas cargadas.' : 'Ya usaste todos tus intentos.'}
            </div>
          )}
        </section>

        {historial.length > 0 && (
          <section className="panel">
            <h3>Tus intentos</h3>
            <table className="tabla">
              <thead><tr><th>#</th><th>Fecha</th><th>Aciertos</th><th>Nota</th><th /></tr></thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td>{h.numero}</td>
                    <td>{new Date(h.finalizadoEn).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{h.correctas}/{h.total}</td>
                    <td className={h.porcentaje >= config.porcentajeAprobacion ? 'ok' : 'mal'}>{h.porcentaje.toFixed(0)}%</td>
                    <td><button className="ver" onClick={() => onVerResultado(h.id)}>Ver detalle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
