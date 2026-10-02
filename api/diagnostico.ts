import { route } from './_lib/http.js';
import { config, VERSION } from './_lib/config.js';

// GET /api/diagnostico  → qué configuración está leyendo la web (sin revelar contraseñas)
export default route(['GET'], async (_req, res) => {
  const crudo = process.env.ADMIN_KEY ?? '';
  res.status(200).json({
    version: VERSION,
    adminUsuario: config.adminUsuario,
    adminKey: {
      configurada: crudo.length > 0,
      largoOriginal: crudo.length,
      largoUsado: config.adminKey.length,
      teniaEspaciosOComillas: crudo !== config.adminKey,
    },
    usuarios: config.usuarios.map((u) => u.usuario),
    maxIntentos: config.intentosIlimitados ? 'ilimitados' : config.maxIntentos,
    jwtSecretOk: (process.env.JWT_SECRET ?? '').length >= 32,
    baseDeDatos: Boolean(process.env.DATABASE_URL),
  });
});
