import { useState, type FormEvent } from 'react';
import { api, ApiError, setToken, type Estado, type Sesion } from '../api';
import { SUBTITULO, TITULO } from '../App';
import { TrazoECG } from './Iconos';

export default function Login({ onIngreso }: { onIngreso: (s: Sesion, e: Estado) => void }) {
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(''); setCargando(true);
    try {
      const r = await api.ingresar(alias.trim());
      setToken(r.token);
      onIngreso({ token: r.token, estudiante: r.estudiante }, r.estado);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo ingresar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login">
      <section className="login-portada">
        {SUBTITULO && <p className="login-institucion">{SUBTITULO}</p>}
        <div>
          <h1 className="login-titulo">{TITULO}</h1>
          <p className="login-bajada">Practica con casos clínicos en condiciones de examen y revisa cada respuesta al terminar.</p>
        </div>
        <TrazoECG />
      </section>

      <section className="login-form">
        <form onSubmit={enviar} noValidate>
          <h2>Ingresa con tu alias</h2>
          <p className="ayuda">Tu nota quedará registrada con este alias.</p>

          <label className="campo">
            Alias
            <input autoFocus autoComplete="off" spellCheck={false} maxLength={30} value={alias}
                   onChange={(e) => setAlias(e.target.value.replace(/\s/g, ''))}
                   placeholder="estudiante1" aria-describedby="alias-ayuda" />
            <span id="alias-ayuda" className="campo-ayuda">De 3 a 30 caracteres, sin espacios. Debe ser uno que nadie haya usado.</span>
          </label>

          {error && <div className="alerta alerta-error" role="alert">{error}</div>}

          <button className="btn btn-primario btn-bloque" disabled={cargando || alias.trim().length < 3}>
            {cargando ? 'Verificando alias…' : 'Ingresar'}
          </button>
          <p className="ayuda">Durante el examen no cierres la pestaña: el alias solo sirve una vez.</p>
        </form>
      </section>
    </div>
  );
}
