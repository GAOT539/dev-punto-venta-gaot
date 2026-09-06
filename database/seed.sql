USE punto_venta;

INSERT INTO proveedores (nombre, telefono, email)
SELECT 'Nestle Ecuador S.A.', '+593 2 398 0200', 'servicio@nestle.com.ec'
WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Nestle Ecuador S.A.');
INSERT INTO proveedores (nombre, telefono, email)
SELECT 'Cerveceria Nacional', '+593 4 259 0900', 'contacto@cervecerianacional.ec'
WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Cerveceria Nacional');
INSERT INTO proveedores (nombre, telefono, email)
SELECT 'Pronaca', '+593 2 397 6400', 'servicioalcliente@pronaca.com'
WHERE NOT EXISTS (SELECT 1 FROM proveedores WHERE nombre = 'Pronaca');

INSERT INTO productos (proveedor_id, nombre, descripcion)
SELECT p.id, 'Yogur Nestle Natural', 'Yogur natural refrigerado' FROM proveedores p WHERE p.nombre = 'Nestle Ecuador S.A.'
AND NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Yogur Nestle Natural');
INSERT INTO productos (proveedor_id, nombre, descripcion)
SELECT p.id, 'Cereal Nestle Fitness', 'Cereal integral para desayuno' FROM proveedores p WHERE p.nombre = 'Nestle Ecuador S.A.'
AND NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Cereal Nestle Fitness');
INSERT INTO productos (proveedor_id, nombre, descripcion)
SELECT p.id, 'Leche Nido Entera', 'Leche en polvo instantanea' FROM proveedores p WHERE p.nombre = 'Nestle Ecuador S.A.'
AND NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Leche Nido Entera');
INSERT INTO productos (proveedor_id, nombre, descripcion)
SELECT p.id, 'Pilsener Lata', 'Bebida malteada en lata' FROM proveedores p WHERE p.nombre = 'Cerveceria Nacional'
AND NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Pilsener Lata');
INSERT INTO productos (proveedor_id, nombre, descripcion)
SELECT p.id, 'Pony Malta', 'Bebida de malta' FROM proveedores p WHERE p.nombre = 'Cerveceria Nacional'
AND NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Pony Malta');
INSERT INTO productos (proveedor_id, nombre, descripcion)
SELECT p.id, 'Salchicha Mr. Pollo', 'Embutido de pollo refrigerado' FROM proveedores p WHERE p.nombre = 'Pronaca'
AND NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Salchicha Mr. Pollo');
INSERT INTO productos (proveedor_id, nombre, descripcion)
SELECT p.id, 'Jamon Plumrose', 'Jamon cocido rebanado' FROM proveedores p WHERE p.nombre = 'Pronaca'
AND NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Jamon Plumrose');

INSERT INTO variantes_producto (producto_id, sku, codigo_barras, nombre, precio_venta, costo, stock_actual, stock_minimo)
SELECT id, 'NEST-YOG-001', '7861000100012', 'Presentacion 1 litro', 1.85, 1.20, 24, 5 FROM productos WHERE nombre = 'Yogur Nestle Natural'
AND NOT EXISTS (SELECT 1 FROM variantes_producto WHERE sku = 'NEST-YOG-001');
INSERT INTO variantes_producto (producto_id, sku, codigo_barras, nombre, precio_venta, costo, stock_actual, stock_minimo)
SELECT id, 'NEST-CER-001', '7861000100029', 'Caja 300 gramos', 3.75, 2.50, 8, 10 FROM productos WHERE nombre = 'Cereal Nestle Fitness'
AND NOT EXISTS (SELECT 1 FROM variantes_producto WHERE sku = 'NEST-CER-001');
INSERT INTO variantes_producto (producto_id, sku, codigo_barras, nombre, precio_venta, costo, stock_actual, stock_minimo)
SELECT id, 'NEST-LEC-001', '7861000100036', 'Bolsa 1.8 kilogramos', 12.50, 9.20, 6, 4 FROM productos WHERE nombre = 'Leche Nido Entera'
AND NOT EXISTS (SELECT 1 FROM variantes_producto WHERE sku = 'NEST-LEC-001');
INSERT INTO variantes_producto (producto_id, sku, codigo_barras, nombre, precio_venta, costo, stock_actual, stock_minimo)
SELECT id, 'CN-PIL-001', '7861000100043', 'Lata 330 mililitros', 1.10, 0.72, 36, 12 FROM productos WHERE nombre = 'Pilsener Lata'
AND NOT EXISTS (SELECT 1 FROM variantes_producto WHERE sku = 'CN-PIL-001');
INSERT INTO variantes_producto (producto_id, sku, codigo_barras, nombre, precio_venta, costo, stock_actual, stock_minimo)
SELECT id, 'CN-PON-001', '7861000100050', 'Botella 330 mililitros', 0.95, 0.60, 9, 10 FROM productos WHERE nombre = 'Pony Malta'
AND NOT EXISTS (SELECT 1 FROM variantes_producto WHERE sku = 'CN-PON-001');
INSERT INTO variantes_producto (producto_id, sku, codigo_barras, nombre, precio_venta, costo, stock_actual, stock_minimo)
SELECT id, 'PRO-MRP-001', '7861000100067', 'Paquete 500 gramos', 4.80, 3.40, 18, 5 FROM productos WHERE nombre = 'Salchicha Mr. Pollo'
AND NOT EXISTS (SELECT 1 FROM variantes_producto WHERE sku = 'PRO-MRP-001');
INSERT INTO variantes_producto (producto_id, sku, codigo_barras, nombre, precio_venta, costo, stock_actual, stock_minimo)
SELECT id, 'PRO-JAM-001', '7861000100074', 'Paquete 250 gramos', 3.90, 2.75, 3, 5 FROM productos WHERE nombre = 'Jamon Plumrose'
AND NOT EXISTS (SELECT 1 FROM variantes_producto WHERE sku = 'PRO-JAM-001');

INSERT INTO facturas_proveedores (proveedor_id, numero_factura, monto_original, saldo, fecha_emision, fecha_vencimiento)
SELECT id, 'DEMO-NESTLE-001', 850.00, 850.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY) FROM proveedores WHERE nombre = 'Nestle Ecuador S.A.'
AND NOT EXISTS (SELECT 1 FROM facturas_proveedores WHERE numero_factura = 'DEMO-NESTLE-001');
INSERT INTO facturas_proveedores (proveedor_id, numero_factura, monto_original, saldo, fecha_emision, fecha_vencimiento)
SELECT id, 'DEMO-PRONACA-001', 420.00, 420.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 18 DAY) FROM proveedores WHERE nombre = 'Pronaca'
AND NOT EXISTS (SELECT 1 FROM facturas_proveedores WHERE numero_factura = 'DEMO-PRONACA-001');
