CREATE DATABASE IF NOT EXISTS punto_venta;
USE punto_venta;

CREATE TABLE IF NOT EXISTS productos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  descripcion VARCHAR(500) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_productos_activo_nombre (activo, nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS variantes_producto (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(64) NOT NULL,
  codigo_barras VARCHAR(64) NULL,
  nombre VARCHAR(160) NULL,
  precio_venta DECIMAL(12,2) NOT NULL,
  costo DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock_actual DECIMAL(12,3) NOT NULL DEFAULT 0,
  stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_variantes_sku (sku),
  UNIQUE KEY uq_variantes_codigo_barras (codigo_barras),
  INDEX idx_variantes_stock_alerta (activo, stock_actual, stock_minimo),
  CONSTRAINT fk_variantes_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proveedores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(180) NOT NULL,
  identificacion VARCHAR(64) NULL,
  telefono VARCHAR(40) NULL,
  email VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_proveedores_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS caja_turnos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre DATETIME NULL,
  monto_inicial DECIMAL(12,2) NOT NULL,
  efectivo_esperado DECIMAL(12,2) NULL,
  efectivo_real DECIMAL(12,2) NULL,
  diferencia DECIMAL(12,2) NULL,
  estado ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
  INDEX idx_caja_estado_fecha (estado, fecha_apertura)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  caja_turno_id BIGINT UNSIGNED NOT NULL,
  tipo ENUM('ingreso', 'retiro', 'venta') NOT NULL,
  metodo_pago ENUM('efectivo', 'transferencia') NULL,
  monto DECIMAL(12,2) NOT NULL,
  concepto VARCHAR(240) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_movimientos_caja_fecha (caja_turno_id, created_at),
  CONSTRAINT fk_movimientos_caja_turno FOREIGN KEY (caja_turno_id) REFERENCES caja_turnos(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ventas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  caja_turno_id BIGINT UNSIGNED NOT NULL,
  metodo_pago ENUM('efectivo', 'transferencia') NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  costo_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ventas_fecha (created_at),
  INDEX idx_ventas_caja (caja_turno_id, created_at),
  CONSTRAINT fk_ventas_caja FOREIGN KEY (caja_turno_id) REFERENCES caja_turnos(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS venta_detalles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  venta_id BIGINT UNSIGNED NOT NULL,
  variante_id BIGINT UNSIGNED NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  costo_unitario DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  INDEX idx_venta_detalles_venta (venta_id),
  CONSTRAINT fk_venta_detalles_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  CONSTRAINT fk_venta_detalles_variante FOREIGN KEY (variante_id) REFERENCES variantes_producto(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_nombre VARCHAR(180) NOT NULL,
  cliente_identificacion VARCHAR(64) NULL,
  referencia VARCHAR(120) NOT NULL,
  monto_original DECIMAL(12,2) NOT NULL,
  saldo DECIMAL(12,2) NOT NULL,
  fecha_vencimiento DATE NULL,
  estado ENUM('pendiente', 'pagada', 'vencida') NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cxc_estado_vencimiento (estado, fecha_vencimiento),
  INDEX idx_cxc_cliente (cliente_nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS abonos_clientes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cuenta_por_cobrar_id BIGINT UNSIGNED NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  metodo_pago ENUM('efectivo', 'transferencia') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_abonos_cuenta_fecha (cuenta_por_cobrar_id, created_at),
  CONSTRAINT fk_abonos_cuenta FOREIGN KEY (cuenta_por_cobrar_id) REFERENCES cuentas_por_cobrar(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS facturas_proveedores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proveedor_id BIGINT UNSIGNED NOT NULL,
  numero_factura VARCHAR(80) NOT NULL,
  monto_original DECIMAL(12,2) NOT NULL,
  saldo DECIMAL(12,2) NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado ENUM('pendiente', 'pagada', 'vencida') NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_factura_proveedor_numero (proveedor_id, numero_factura),
  INDEX idx_cxp_estado_vencimiento (estado, fecha_vencimiento),
  CONSTRAINT fk_facturas_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
