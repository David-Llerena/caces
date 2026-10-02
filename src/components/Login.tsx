import { useState, type FormEvent } from 'react';
import { api, ApiError, setToken, type Estado, type Sesion } from '../api';
import { SUBTITULO, TITULO } from '../App';
import { TrazoECG } from './Iconos';

export default function Login({ onIngreso }: { onIngreso: (s: Sesion, e?: Estado) => void }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(''); setCargando(true);
    try {
      const r = await api.ingresar(usuario.trim(), clave);
      setToken(r.token);
      if (r.rol === 'admin') onIngreso({ token: r.token, rol: 'admin', estudiante: { alias: 'Administrador' } });
      else onIngreso({ token: r.token, rol: 'estudiante', estudiante: r.estudiante }, r.estado);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo ingresar. Revisa tu conexión e intenta de nuevo.');
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
          <h2>Ingresa a tu cuenta</h2>
          <p className="ayuda">Usa el usuario y la contraseña que te entregaron.</p>

          <label className="campo">
            Usuario
            <input autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={40}
                   value={usuario} onChange={(e) => setUsuario(e.target.value.replace(/\s/g, ''))} />
          </label>

          <label className="campo">
            Contraseña
            <span className="campo-clave">
              <input type={verClave ? 'text' : 'password'} autoComplete="current-password" maxLength={100}
                     value={clave} onChange={(e) => setClave(e.target.value)} />
              <button type="button" className="ver-clave" onClick={() => setVerClave((v) => !v)}
                      aria-pressed={verClave}>{verClave ? 'Ocultar' : 'Mostrar'}</button>
            </span>
          </label>

          {error && <div className="alerta alerta-error" role="alert">{error}</div>}

          <button className="btn btn-primario btn-bloque" disabled={cargando || !usuario.trim() || !clave}>
            {cargando ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </div>
  );
}
