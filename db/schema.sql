-- =====================================================================
-- Simulacro de examen - esquema PostgreSQL (Neon en producción)
-- Idempotente: se puede ejecutar varias veces sin romper nada.
-- =====================================================================

-- Participantes: un registro por usuario habilitado (se crea en su primer ingreso)
CREATE TABLE IF NOT EXISTS estudiante (
    id          SERIAL PRIMARY KEY,
    alias       VARCHAR(30)  NOT NULL,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ip          VARCHAR(64),
    navegador   TEXT
);
-- Alias único sin importar mayúsculas: "Estudiante1" = "estudiante1"
CREATE UNIQUE INDEX IF NOT EXISTS ux_estudiante_alias ON estudiante (lower(alias));
-- v2: usuarios fijos con contraseña (USUARIOS en Vercel)
ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS ultimo_ingreso  TIMESTAMPTZ;
ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS ingresos        INT NOT NULL DEFAULT 0;
ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS fallos_login    INT NOT NULL DEFAULT 0;
ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

-- v3: registro de cada ingreso (histórico por hora)
CREATE TABLE IF NOT EXISTS acceso (
    id            SERIAL PRIMARY KEY,
    estudiante_id INT NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    fecha         TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip            VARCHAR(64),
    navegador     TEXT
);
CREATE INDEX IF NOT EXISTS ix_acceso_estudiante ON acceso (estudiante_id, fecha DESC);

-- Banco de preguntas
CREATE TABLE IF NOT EXISTS pregunta (
    id         SERIAL PRIMARY KEY,
    codigo     VARCHAR(30)  NOT NULL UNIQUE,          -- id del CSV, permite recargar sin duplicar
    area       VARCHAR(100) NOT NULL DEFAULT 'General',
    enunciado  TEXT         NOT NULL,
    activa     BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS opcion (
    id           SERIAL PRIMARY KEY,
    pregunta_id  INT     NOT NULL REFERENCES pregunta(id) ON DELETE CASCADE,
    letra        CHAR(1) NOT NULL,
    texto        TEXT    NOT NULL,
    es_correcta  BOOLEAN NOT NULL DEFAULT FALSE,     -- NUNCA se envía al front
    UNIQUE (pregunta_id, letra)
);

-- Intentos: la hora de expiración la fija el servidor
CREATE TABLE IF NOT EXISTS intento (
    id             SERIAL PRIMARY KEY,
    estudiante_id  INT         NOT NULL REFERENCES estudiante(id),
    numero         INT         NOT NULL,
    estado         VARCHAR(15) NOT NULL DEFAULT 'EN_CURSO',   -- EN_CURSO | FINALIZADO
    iniciado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en      TIMESTAMPTZ NOT NULL,
    finalizado_en  TIMESTAMPTZ,
    preguntas      INT[]       NOT NULL,                       -- orden aleatorio asignado
    correctas      INT,
    total          INT,
    porcentaje     NUMERIC(5,2),
    UNIQUE (estudiante_id, numero)
);

-- Un estudiante solo puede tener un intento en curso a la vez
CREATE UNIQUE INDEX IF NOT EXISTS ux_intento_en_curso
    ON intento (estudiante_id) WHERE estado = 'EN_CURSO';

-- Respuestas (autoguardado pregunta por pregunta)
CREATE TABLE IF NOT EXISTS respuesta (
    intento_id     INT         NOT NULL REFERENCES intento(id) ON DELETE CASCADE,
    pregunta_id    INT         NOT NULL REFERENCES pregunta(id),
    opcion_id      INT         NOT NULL REFERENCES opcion(id),
    respondido_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (intento_id, pregunta_id)
);
