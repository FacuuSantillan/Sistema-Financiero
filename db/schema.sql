-- ==========================================================
-- VALORA · SISTEMA FINANCIERO — ESTRUCTURA COMPLETA DE LA BASE
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar TODO → Run.
--
-- Sirve para un proyecto nuevo (crea todo) y para uno existente
-- (solo agrega lo que falta). Se puede correr más de una vez:
-- no borra tablas ni datos.
-- ==========================================================


-- ----------------------------------------------------------
-- 1. TABLAS
-- ----------------------------------------------------------

-- Provincias
CREATE TABLE IF NOT EXISTS provincias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL
);

-- Usuarios del sistema (owner / admin). El id es el mismo de auth.users.
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo VARCHAR(255) NOT NULL,
  dni VARCHAR(50),
  email VARCHAR(255),
  telefono VARCHAR(100),
  direccion TEXT,
  rol VARCHAR(50) DEFAULT 'admin',
  provincia_id UUID REFERENCES provincias(id) ON DELETE SET NULL,
  capital_disponible NUMERIC(12,2) DEFAULT 0,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo VARCHAR(255) NOT NULL,
  dni VARCHAR(50),
  telefono VARCHAR(100),
  direccion TEXT,
  inversionista_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  provincia_id UUID REFERENCES provincias(id) ON DELETE SET NULL,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Datos ampliados del cliente (se agregan también en bases existentes)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20) DEFAULT 'DNI';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS condicion_fiscal VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS localidad VARCHAR(255);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ocupacion VARCHAR(255);
-- Rutas de las fotos dentro del bucket "documentacion"
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS documentos JSONB DEFAULT '[]'::jsonb;

-- Garantes (uno o más por cliente)
CREATE TABLE IF NOT EXISTS garantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(255) NOT NULL,
  tipo_documento VARCHAR(20) DEFAULT 'DNI',
  dni VARCHAR(50),
  condicion_fiscal VARCHAR(100),
  email VARCHAR(255),
  telefono VARCHAR(100),
  direccion TEXT,
  localidad VARCHAR(255),
  provincia_id UUID REFERENCES provincias(id) ON DELETE SET NULL,
  ocupacion VARCHAR(255),
  documentos JSONB DEFAULT '[]'::jsonb,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS garantes_cliente_id_idx ON garantes(cliente_id);

-- Opciones de préstamo
-- opciones_cuotas: [{ "cuotas": 3, "interes": 15 }, ...]
-- tasa_interes / plazo_cuotas guardan la primera opción (compatibilidad).
CREATE TABLE IF NOT EXISTS planes_prestamo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255),
  monto NUMERIC(12,2),
  tasa_interes NUMERIC(5,2) NOT NULL DEFAULT 0,
  plazo_cuotas INT DEFAULT 1,
  opciones_cuotas JSONB DEFAULT '[]'::jsonb,
  frecuencia_pago VARCHAR(50) DEFAULT 'mensual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Préstamos
CREATE TABLE IF NOT EXISTS prestamos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  inversionista_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  provincia_id UUID REFERENCES provincias(id) ON DELETE SET NULL,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  monto_capital NUMERIC(12,2) NOT NULL,
  monto_total_pagar NUMERIC(12,2) NOT NULL,
  monto_cuota NUMERIC(12,2) NOT NULL,
  cantidad_cuotas INT NOT NULL DEFAULT 1,
  frecuencia VARCHAR(50) DEFAULT 'mensual',
  estado VARCHAR(50) DEFAULT 'activo',
  fecha_inicio DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prestamos_cliente_id_idx ON prestamos(cliente_id);

-- Punitorio por préstamo:
--   punitorio_aplica = false  → el préstamo está exento de punitorio
--   punitorio_tasa / punitorio_cada_dias en NULL → usa la configuración general
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS punitorio_aplica BOOLEAN DEFAULT true;
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS punitorio_tasa NUMERIC(6,3);
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS punitorio_cada_dias INT;

-- Configuración general del sistema (una sola fila, id = 1)
CREATE TABLE IF NOT EXISTS configuracion (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  punitorio_tasa NUMERIC(6,3) NOT NULL DEFAULT 0.5,      -- % por período
  punitorio_cada_dias INT NOT NULL DEFAULT 1 CHECK (punitorio_cada_dias >= 1),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO configuracion (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Las cuotas no se guardan en una tabla: el cronograma se calcula en la app
-- a partir del préstamo y sus pagos (ver src/lib/finanzas.js).

-- Pagos / cobros
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id UUID REFERENCES prestamos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  inversionista_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  monto_cobrado NUMERIC(12,2) NOT NULL,
  metodo_pago VARCHAR(100) DEFAULT 'efectivo',
  observaciones TEXT,
  fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Punitorio cobrado junto con un pago (separado del monto de la cuota)
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS punitorio NUMERIC(12,2) DEFAULT 0;
-- Detalle del cálculo:
-- { "tasa": 0.5, "cada_dias": 1,
--   "cuotas": [{ "numero": 2, "dias_atraso": 12, "periodos": 12, "saldo": 10000, "monto": 600 }] }
-- "periodos" = períodos de mora que ya se cobraron de esa cuota (evita cobrarlos dos veces)
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS punitorio_detalle JSONB;

CREATE INDEX IF NOT EXISTS pagos_prestamo_id_idx ON pagos(prestamo_id);

-- Auditoría (Registro de actividades)
CREATE TABLE IF NOT EXISTS auditoria_actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,        -- CLIENTE, GARANTE, ADMIN, PRÉSTAMO, COBRO
  accion VARCHAR(50) NOT NULL,      -- CREADO, EDITADO, COBRO, ...
  titulo TEXT,
  subtitulo TEXT,
  detalles TEXT,
  persona VARCHAR(255),
  autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_nombre VARCHAR(255),
  autor_rol VARCHAR(50),
  estado VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ----------------------------------------------------------
-- 2. SEGURIDAD (permisos + RLS)
-- Los proyectos nuevos de Supabase no dan permisos automáticos
-- sobre las tablas creadas por SQL: sin estos GRANT la app recibe
-- "permission denied" (error 42501).
-- Solo los usuarios que iniciaron sesión (authenticated) tienen
-- acceso; la clave pública (anon) no puede leer ni escribir nada.
-- ----------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- Tablas que se creen más adelante también quedan accesibles
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'provincias', 'usuarios', 'clientes', 'garantes', 'planes_prestamo',
    'prestamos', 'pagos', 'auditoria_actividades', 'configuracion'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tabla || '_autenticados', tabla);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tabla || '_autenticados', tabla
    );
  END LOOP;
END $$;


-- ----------------------------------------------------------
-- 3. FOTOS DE DOCUMENTACIÓN (bucket PRIVADO de Storage)
-- ----------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentacion', 'documentacion', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documentacion_leer" ON storage.objects;
CREATE POLICY "documentacion_leer" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentacion');

DROP POLICY IF EXISTS "documentacion_subir" ON storage.objects;
CREATE POLICY "documentacion_subir" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentacion');

DROP POLICY IF EXISTS "documentacion_borrar" ON storage.objects;
CREATE POLICY "documentacion_borrar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentacion');


-- ----------------------------------------------------------
-- 4. DATOS INICIALES: las 24 jurisdicciones de Argentina
-- (solo inserta las que no existan, no duplica)
-- ----------------------------------------------------------

INSERT INTO provincias (nombre)
SELECT p.nombre
FROM (VALUES
  ('Buenos Aires'), ('Catamarca'), ('Chaco'), ('Chubut'),
  ('Ciudad Autónoma de Buenos Aires'), ('Córdoba'), ('Corrientes'),
  ('Entre Ríos'), ('Formosa'), ('Jujuy'), ('La Pampa'), ('La Rioja'),
  ('Mendoza'), ('Misiones'), ('Neuquén'), ('Río Negro'), ('Salta'),
  ('San Juan'), ('San Luis'), ('Santa Cruz'), ('Santa Fe'),
  ('Santiago del Estero'), ('Tierra del Fuego'), ('Tucumán')
) AS p(nombre)
WHERE NOT EXISTS (SELECT 1 FROM provincias x WHERE x.nombre = p.nombre);


-- ----------------------------------------------------------
-- 5. USUARIO OWNER (dueño del sistema) — paso manual
--
-- a) Creá tu usuario en Supabase → Authentication → Users → Add user
--    (con email y contraseña, marcando "Auto Confirm User").
-- b) Reemplazá TU_EMAIL y TU NOMBRE abajo, sacá los "--" de las
--    5 líneas del INSERT y ejecutá solo ese bloque.
-- ----------------------------------------------------------

-- INSERT INTO usuarios (id, nombre_completo, email, rol, activo)
-- SELECT id, 'TU NOMBRE', email, 'owner', true
-- FROM auth.users
-- WHERE email = 'TU_EMAIL'
-- ON CONFLICT (id) DO UPDATE SET rol = 'owner', activo = true;
