import type { ReactNode } from 'react';
import { SUBTITULO, TITULO } from '../App';
import { Pulso } from './Iconos';

export default function Encabezado({ nombre, derecha }: { nombre?: string; derecha?: ReactNode }) {
  return (
    <header className="encabezado">
      <div className="marca">
        <Pulso />
        <div>
          <div className="marca-titulo">{TITULO}</div>
          {SUBTITULO && <div className="marca-sub">{SUBTITULO}</div>}
        </div>
      </div>
      <div className="encabezado-der">
        {nombre && <span className="usuario">{nombre}</span>}
        {derecha}
      </div>
    </header>
  );
}
