import { useEffect, useState } from 'react';
import { api, ApiError, guardarSesion, sesionGuardada, setToken, type Estado, type IntentoData, type Resultado, type Sesion } from './api';
import Login from './components/Login';
import Inicio from './components/Inicio';
import Examen from './components/Examen';
import ResultadoView from './components/Resultado';
import Admin from './components/Admin';

export const TITULO = import.meta.env.VITE_TITULO ?? 'Simulacro de Evaluación';
export const SUBTITULO = import.meta.env.VITE_SUBTITULO ?? '';

type Vista =
  | { tipo: 'cargando' }
  | { tipo: 'login' }
  | { tipo: 'inicio'; estado: Estado }
  | { tipo: 'examen'; intento: IntentoData }
  | { tipo: 'resultado'; resultado: Resultado };

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(sesionGuardada());
  const [vista, setVista] = useState<Vista>({ tipo: sesion ? 'cargando' : 'login' });

  const salir = () => { guardarSesion(null); setToken(''); setSesion(null); setVista({ tipo: 'login' }); };

  const manejarError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) salir();
    else throw e;
  };

  const irAInicio = () => api.estado().then((estado) => setVista({ tipo: 'inicio', estado })).catch(manejarError);

  useEffect(() => { if (sesion && sesion.rol !== 'admin') irAInicio(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const alIngresar = (s: Sesion, estado?: Estado) => {
    guardarSesion(s); setToken(s.token); setSesion(s);
    setVista(estado ? { tipo: 'inicio', estado } : { tipo: 'cargando' });
  };

  if (vista.tipo === 'login' || !sesion) return <Login onIngreso={alIngresar} />;
  if (sesion.rol === 'admin') return <Admin onSalir={salir} />;
  if (vista.tipo === 'cargando') return <div className="pantalla-centro"><div className="spinner" /></div>;

  if (vista.tipo === 'inicio') {
    return (
      <Inicio
        sesion={sesion}
        estado={vista.estado}
        onSalir={salir}
        onComenzar={async () => {
          try { setVista({ tipo: 'examen', intento: await api.iniciar() }); }
          catch (e) { manejarError(e); }
        }}
        onVerResultado={async (id) => {
          try { setVista({ tipo: 'resultado', resultado: await api.resultado(id) }); }
          catch (e) { manejarError(e); }
        }}
      />
    );
  }

  if (vista.tipo === 'examen') {
    return (
      <Examen
        sesion={sesion}
        intento={vista.intento}
        onFinalizado={(resultado) => setVista({ tipo: 'resultado', resultado })}
        onSesionExpirada={salir}
      />
    );
  }

  return (
    <ResultadoView
      sesion={sesion} resultado={vista.resultado} onVolver={irAInicio} onSalir={salir}
      onReintentar={async () => {
        const estado = await api.estado();
        if (!estado.puedeIniciar && !estado.intentoEnCurso) { setVista({ tipo: 'inicio', estado }); return; }
        setVista({ tipo: 'examen', intento: await api.iniciar() });
      }}
    />
  );
}
