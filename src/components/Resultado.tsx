import type { Resultado as R, Sesion } from '../api';
import Encabezado from './Encabezado';
import Revision from './Revision';

export const duracion = (s: number) => {
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m ? `${m} min` : `${s} s`;
};

/** Bloque de nota reutilizado por el estudiante y por el panel admin */
export function Veredicto({ r, titulo }: { r: R; titulo: string }) {
  return (
    <section className={`panel veredicto ${r.aprobado ? 'aprobado' : 'reprobado'}`}>
      <div className="veredicto-nota">{r.porcentaje.toFixed(0)}<small>%</small></div>
      <div className="veredicto-texto">
        <h2>{r.aprobado ? 'Aprobado' : 'No alcanzó el mínimo'}</h2>
        <p>{titulo}</p>
      </div>
      <div className="escala" role="img" aria-label={`Nota ${r.porcentaje.toFixed(0)}%, mínimo ${r.porcentajeAprobacion}%`}>
        <div className="escala-relleno" style={{ width: `${r.porcentaje}%` }} />
        <div className="escala-minimo" style={{ left: `${r.porcentajeAprobacion}%` }}><span>Mínimo {r.porcentajeAprobacion}%</span></div>
      </div>
      <dl className="datos">
        <div><dt>Aciertos</dt><dd>{r.correctas} <small>de {r.total}</small></dd></div>
        <div><dt>Respondidas</dt><dd>{r.respondidas}</dd></div>
        <div><dt>Sin responder</dt><dd>{r.total - r.respondidas}</dd></div>
        <div><dt>Tiempo usado</dt><dd>{duracion(r.duracionSegundos)}</dd></div>
      </dl>
    </section>
  );
}

export function PorArea({ r }: { r: R }) {
  return (
    <section className="panel">
      <h3>Resultado por área</h3>
      {r.porArea.map((a) => (
        <div key={a.area} className="area">
          <span>{a.area}</span>
          <span><strong>{a.correctas}</strong> de {a.total}</span>
          <div className="area-barra"><div style={{ width: `${a.total ? (a.correctas / a.total) * 100 : 0}%` }} /></div>
        </div>
      ))}
    </section>
  );
}

export default function Resultado({ sesion, resultado: r, onVolver, onSalir }:
  { sesion: Sesion; resultado: R; onVolver: () => void; onSalir: () => void }) {
  return (
    <div className="pagina">
      <Encabezado nombre={sesion.estudiante.alias}
                  derecha={<button className="btn btn-fantasma btn-sm" onClick={onSalir}>Salir</button>} />
      <main className="contenedor estrecho">
        <Veredicto r={r} titulo={`Intento ${r.numero} de ${sesion.estudiante.alias}`} />
        <PorArea r={r} />
        {r.revision.length > 0 && <Revision items={r.revision} />}
        <button className="btn btn-secundario volver" onClick={onVolver}>Volver al inicio</button>
      </main>
    </div>
  );
}
