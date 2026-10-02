import { useState } from 'react';
import type { ItemRevision } from '../api';

type Filtro = 'todas' | 'bien' | 'mal' | 'blanco';

export default function Revision({ items }: { items: ItemRevision[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const n = {
    todas: items.length,
    bien: items.filter((i) => i.acierto).length,
    mal: items.filter((i) => i.elegida !== null && !i.acierto).length,
    blanco: items.filter((i) => i.elegida === null).length,
  };
  const visibles = items.filter((i) =>
    filtro === 'todas' ? true : filtro === 'bien' ? i.acierto : filtro === 'mal' ? i.elegida !== null && !i.acierto : i.elegida === null);

  const etiquetas: [Filtro, string][] = [['todas', 'Todas'], ['bien', 'Correctas'], ['mal', 'Incorrectas'], ['blanco', 'Sin responder']];

  return (
    <section className="panel">
      <h3>Revisión pregunta por pregunta</h3>
      <div className="filtros" role="tablist">
        {etiquetas.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={filtro === k}
                  className={`filtro filtro-${k}`} onClick={() => setFiltro(k)}>
            {t}<b>{n[k]}</b>
          </button>
        ))}
      </div>

      {visibles.length === 0 && <p className="vacio">No hay preguntas en esta categoría.</p>}

      <ol className="revision">
        {visibles.map((it) => {
          const estado = it.elegida === null ? 'blanco' : it.acierto ? 'bien' : 'mal';
          return (
            <li key={it.preguntaId} className={`rev rev-${estado}`}>
              <div className="rev-cab">
                <span className="rev-num">Pregunta {it.numero}</span>
                <span className="chip">{it.area}</span>
                <span className={`rev-estado ${estado}`}>
                  {estado === 'bien' ? 'Correcta' : estado === 'mal' ? 'Incorrecta' : 'Sin responder'}
                </span>
              </div>
              <p className="rev-enunciado">{it.enunciado}</p>
              <ul className="rev-opciones">
                {it.opciones.map((o) => {
                  const elegida = o.id === it.elegida;
                  const cls = o.correcta ? 'correcta' : elegida ? 'erronea' : '';
                  return (
                    <li key={o.id} className={cls}>
                      <span className="opcion-letra">{o.letra}</span>
                      <span className="rev-texto">{o.texto}</span>
                      {elegida ? <span className={`rev-tag ${o.correcta ? 'ok' : ''}`}>Elegida</span>
                        : o.correcta ? <span className="rev-tag ok">Respuesta correcta</span> : <span />}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
