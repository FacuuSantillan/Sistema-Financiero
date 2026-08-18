-- ==========================================
-- SCRIPT COMPLETO DE RESPALDO DE ESTRUCTURA
-- ==========================================

-- Tabla de Provincias
CREATE TABLE IF NOT EXISTS provincias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL
);

-- Tabla de Usuarios (Inversionistas / Administradores)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255),
  nombre_completo VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefono VARCHAR(100),
  rol VARCHAR(50) DEFAULT 'inversionista',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_completo VARCHAR(255) NOT NULL,
  dni VARCHAR(50),
  telefono VARCHAR(100),
  email VARCHAR(255),
  direccion TEXT,
  inversionista_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  provincia_id UUID REFERENCES provincias(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Planes de Préstamo
CREATE TABLE IF NOT EXISTS planes_prestamo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255),
  monto NUMERIC(12,2),
  tasa_interes NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Préstamos
CREATE TABLE IF NOT EXISTS prestamos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  inversionista_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  provincia_id UUID REFERENCES provincias(id) ON DELETE SET NULL,
  monto_capital NUMERIC(12,2) NOT NULL,
  tasa_interes NUMERIC(5,2) NOT NULL,
  monto_total_pagar NUMERIC(12,2) NOT NULL,
  monto_cuota NUMERIC(12,2) NOT NULL,
  cantidad_cuotas INT NOT NULL DEFAULT 1,
  frecuencia VARCHAR(50) DEFAULT 'mensual',
  estado VARCHAR(50) DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'cancelado', 'pendiente', 'cobrado')),
  fecha_inicio DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Cuotas
CREATE TABLE IF NOT EXISTS cuotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestamo_id UUID REFERENCES prestamos(id) ON DELETE CASCADE,
  numero_cuota INT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  fecha_vencimiento DATE,
  estado VARCHAR(50) DEFAULT 'pendiente'
);

-- Tabla de Pagos
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestamo_id UUID REFERENCES prestamos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  inversionista_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  monto_cobrado NUMERIC(12,2) NOT NULL,
  metodo_pago VARCHAR(100) DEFAULT 'efectivo',
  observaciones TEXT,
  fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);