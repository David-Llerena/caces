# Simulacro de Evaluación

Web de simulacro de examen de opción múltiple. El front está en React + Vite, el back en funciones Node de Vercel (`/api`) y la base en PostgreSQL de Neon. Todo vive en un solo repo y se despliega con un `git push`.

```
Navegador ──HTTPS──> Vercel  (https://tu-proyecto.vercel.app)
                     ├─ /          → página del estudiante (alias → examen → nota + revisión)
                     ├─ /admin     → panel con el histórico (protegido con ADMIN_KEY)
                     └─ /api/*     → funciones Node: registra alias, califica, controla el tiempo
                                       │
                                       └──> Neon (PostgreSQL en la nube, región AWS)
```

## Flujo

1. El estudiante abre el link y escribe un **alias**, por ejemplo `estudiante1`.
   - Si el alias **ya existe** en la base, se rechaza con "ya fue usado, elige otro". La validación no distingue mayúsculas: `Estudiante1` cuenta igual que `estudiante1`.
   - Formato permitido: de 3 a 30 caracteres, con letras, números, `.`, `-` o `_`, sin espacios.
2. Rinde el examen. Tiene temporizador, navegación entre preguntas y "marcar para revisar". Cada respuesta se guarda al momento.
3. Al terminar ve **su nota**, el desglose por área y la **revisión pregunta por pregunta**: su respuesta, la correcta y si acertó. Puede filtrar por correctas, incorrectas o sin responder.
4. Tú ves todo en **`/admin`**.

## ¿Dónde se guarda el histórico?

Todo queda en la base PostgreSQL (Neon) y nada se borra:

| Tabla | Qué guarda |
|---|---|
| `estudiante` | Cada alias que ingresó, con fecha/hora, IP y navegador |
| `intento` | Inicio, fin, aciertos, total y porcentaje |
| `respuesta` | Qué opción eligió en cada pregunta y a qué hora |
| `pregunta` / `opcion` | Banco de preguntas con la respuesta correcta |

### Panel `/admin`

Entra a `https://tu-proyecto.vercel.app/admin` con tu `ADMIN_KEY`. Ahí ves:

- **Indicadores:** cuántos ingresaron, terminaron, están en curso o sin iniciar, cuántos aprobaron y el promedio.
- **Tabla de alias:** fecha de ingreso, estado, respondidas, aciertos, nota y duración. Tiene buscador y filtro por estado, y se actualiza sola cada 30 s.
- **Detalle de cada alias** (clic en la fila): nota, resultado por área y la revisión completa de sus respuestas.
- **Descargar CSV** para Excel.

Si quieres consultar directo con SQL, usa el **SQL Editor** de Neon, o conéctate con DBeaver o pgAdmin usando la cadena de conexión:

```sql
SELECT e.alias, i.porcentaje, i.correctas, i.total, i.finalizado_en
  FROM estudiante e JOIN intento i ON i.estudiante_id = e.id
 ORDER BY i.porcentaje DESC;
```

## Seguridad: lo que sí cubre y lo que no

- Durante el examen, las respuestas correctas **no** llegan al navegador. La nota se calcula en el servidor.
- El tiempo lo controla el servidor. Las respuestas que llegan después del tiempo se rechazan y el intento se cierra solo.
- Recargar la página (F5) no pierde nada: continúa el mismo intento.
- ⚠️ **Si el estudiante cierra la pestaña, pierde el acceso a su alias.** No hay contraseña, así que la sesión vive solo en esa pestaña. Lo que alcanzó a responder igual queda guardado y se califica solo cuando vence el tiempo.
- ⚠️ **Cualquiera con el link puede entrar** con un alias nuevo, y una misma persona podría rendir varias veces con alias distintos. Comparte el link solo con tu grupo.
- Al terminar se muestran las respuestas correctas, así que alguien podría pasárselas a otros. Si no quieres eso, pon `MOSTRAR_REVISION=false`: el estudiante solo verá su nota y tú seguirás viendo la revisión en `/admin`.

## Estructura

```
api/
  ingresar.ts  estado.ts  intento.ts  respuesta.ts  enviar.ts  resultado.ts
  admin/resumen.ts  admin/detalle.ts  admin/resultados.ts (CSV)
  _lib/                          → db, JWT, lógica del examen y del panel
src/                             → React: Login (alias), Inicio, Examen, Resultado, Revision, Admin
db/schema.sql                    → tablas
data/ejemplo-preguntas.csv       → formato del banco de preguntas
scripts/                         → db-init, cargar-datos, servidor API local
```

---

## 1. Correrlo en local

Requisitos: Node 20+ y un Postgres, que puede ser local o la misma base de Neon.

```bash
npm install
cp .env.example .env.local        # ajusta DATABASE_URL, JWT_SECRET y ADMIN_KEY
npm run db:init                   # crea las tablas
npm run db:cargar -- --preguntas data/ejemplo-preguntas.csv

# dos terminales:
npm run dev:api                   # API en :3001 (imita a Vercel)
npm run dev                       # web en http://localhost:5173  (panel: /admin)
```

## 2. Cargar tus preguntas

Crea `data/preguntas.csv`. Las columnas `e` y `activa` son opcionales:

```csv
codigo,area,enunciado,a,b,c,d,correcta
P001,Razonamiento,"Complete la serie: 2, 6, 12, 20, ...",28,30,32,26,B
```

- `codigo` identifica la pregunta. Si recargas el CSV, la pregunta **se actualiza** en vez de duplicarse.
- `area` agrupa el resultado.
- `correcta` es la letra de la respuesta correcta.
- Acepta separador `,` o `;` (el `;` es el que usa Excel en español).
- Para desactivar una pregunta sin borrarla, pon `activa` = `no`.

```bash
npm run db:cargar
```

> `.gitignore` excluye `data/*.csv` (menos el de ejemplo), así que las respuestas correctas **no se suben al repo**.

---

## 3. Desplegar en Vercel + Neon

1. **Sube el repo a GitHub.** Mejor como privado; Vercel lo lee igual.
2. **En Vercel:** *Add New → Project*, importa el repo. Detecta Vite solo.
3. **Base de datos:** en el proyecto, *Storage → Create Database → Neon (Postgres)*. Elige la región **US East (Virginia)**, que es la misma de las funciones de Vercel, y conéctala al proyecto.
   - Luego verifica en *Settings → Environment Variables* que exista **`DATABASE_URL`**. Si solo aparece `POSTGRES_URL`, crea `DATABASE_URL` con ese mismo valor.
   - Usa la cadena **pooled** (el host lleva `-pooler`).
4. **Variables de entorno:**

   | Variable | Valor |
   |---|---|
   | `JWT_SECRET` | genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `ADMIN_KEY` | clave larga, solo tuya (para `/admin`) |
   | `DURACION_MINUTOS` | `60` |
   | `MAX_INTENTOS` | `1` |
   | `NUM_PREGUNTAS` | `0` (todas) o N preguntas aleatorias |
   | `PORCENTAJE_APROBACION` | `70` |
   | `MOSTRAR_REVISION` | `true` / `false` |
   | `VITE_TITULO` / `VITE_SUBTITULO` | textos del encabezado |

5. **Crear las tablas y cargar las preguntas en Neon desde tu PC:** pon la `DATABASE_URL` de Neon en tu `.env.local` y corre:
   ```bash
   npm run db:init
   npm run db:cargar
   ```
6. **Deploy:** haz *Redeploy* o un `git push`. La web queda en `https://<tu-proyecto>.vercel.app`.

> Si cambias una variable de entorno, haz **Redeploy** para que se aplique.

## 4. Compartir

- **Estudiantes:** les pasas `https://<tu-proyecto>.vercel.app` por WhatsApp, correo o el aula virtual. Entran desde el navegador de su PC; no instalan nada ni necesitan cuenta.
- **Tú:** `https://<tu-proyecto>.vercel.app/admin`.
- **Dominio propio (opcional):** si quieres usar algo como `simulacro.tuinstituto.edu.ec`, agrégalo en *Settings → Domains*.

## 5. Mantenimiento

- **Volver a rendir con el mismo alias:** `DELETE FROM intento WHERE estudiante_id = (SELECT id FROM estudiante WHERE lower(alias) = 'estudiante1');`
- **Liberar un alias** (por ejemplo, si cerró la pestaña sin empezar): `DELETE FROM estudiante WHERE lower(alias) = 'estudiante1';` (solo si no tiene intentos).
- **Empezar un simulacro nuevo desde cero:** `TRUNCATE respuesta, intento, estudiante RESTART IDENTITY;`
- **Al terminar:** descarga el CSV y elimina el proyecto en Vercel y la base en Neon.

## Notas

- **Planes gratuitos:** Vercel Hobby y Neon Free alcanzan de sobra para un grupo. Revisa sus condiciones vigentes; el plan Hobby de Vercel está pensado para uso no comercial.
- **No es proctoring:** no impide que el estudiante consulte en otra pestaña.
