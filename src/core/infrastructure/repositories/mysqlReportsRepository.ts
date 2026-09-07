import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { RowDataPacket } from "mysql2/promise";

export class MysqlReportsRepository {
  async getReportsData(fechaInicio?: string, fechaFin?: string) {
    const pool = getMysqlPool();
    
    let dateFilter = "";
    const params: any[] = [];
    if (fechaInicio && fechaFin) {
       dateFilter = "AND DATE(created_at) BETWEEN ? AND ?";
       params.push(fechaInicio, fechaFin);
    }
    
    let dateFilterWhere = "";
    if (fechaInicio && fechaFin) {
       dateFilterWhere = "WHERE DATE(created_at) BETWEEN ? AND ?";
    }

    // 1. Ingresos vs Egresos (Últimos 6 meses)
    const [ingresosEgresosRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as mes,
        SUM(CASE WHEN tipo IN ('ingreso', 'venta') THEN monto ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'retiro' THEN monto ELSE 0 END) as egresos
      FROM movimientos_caja
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY mes
      ORDER BY mes ASC
    `);

    // 2. Ventas por Día (Últimos 15 días)
    const [ventasDiaRows] = await pool.execute<RowDataPacket[]>(`
      SELECT DATE(created_at) as fecha, SUM(total) as total 
      FROM ventas 
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 15 DAY) 
      GROUP BY fecha 
      ORDER BY fecha ASC
    `);

    // 3. Top Productos Más Vendidos
    const [topProductosRows] = await pool.execute<RowDataPacket[]>(`
      SELECT COALESCE(v.nombre, p.nombre, 'Producto') as nombre, SUM(vd.cantidad) as cantidad 
      FROM venta_detalles vd 
      JOIN variantes_producto v ON vd.variante_id = v.id 
      LEFT JOIN productos p ON v.producto_id = p.id
      GROUP BY v.id 
      ORDER BY cantidad DESC 
      LIMIT 5
    `);

    // 4. Métodos de Pago
    const [metodosPagoRows] = await pool.execute<RowDataPacket[]>(`
      SELECT metodo_pago as nombre, COUNT(*) as cantidad 
      FROM ventas 
      GROUP BY metodo_pago
    `);

    // 5. Flujo de Caja (Últimos 15 días acumulativo de neto por día)
    const [flujoCajaRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE(created_at) as fecha, 
        SUM(CASE WHEN tipo IN ('ingreso', 'venta') THEN monto ELSE -monto END) as neto
      FROM movimientos_caja
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 15 DAY)
      GROUP BY fecha
      ORDER BY fecha ASC
    `);

    // 6. Horas Pico de Ventas
    const [horasPicoRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(created_at, '%H:00') as hora, 
        COUNT(*) as tickets 
      FROM ventas 
      GROUP BY hora 
      ORDER BY hora ASC
    `);

    // Tablas Compactas
    
    // Top 5 Productos con mayor margen
    const [topMargenRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COALESCE(v.nombre, p.nombre, 'Producto') as nombre, 
        (v.precio_venta - v.costo) as margen 
      FROM variantes_producto v
      LEFT JOIN productos p ON v.producto_id = p.id
      WHERE v.precio_venta > v.costo
      ORDER BY margen DESC 
      LIMIT 5
    `);

    // Margen de Ganancias por Día
    const [margenPorDiaRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE(created_at) as fecha, 
        SUM(total) as ingresos, 
        SUM(costo_total) as costos, 
        SUM(total - costo_total) as margen 
      FROM ventas 
      ${dateFilterWhere}
      GROUP BY fecha 
      ORDER BY fecha DESC 
      LIMIT 30
    `, params);

    // Historial de Ventas Detallado con Margen
    const [historialVentasRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        id as ticket, 
        created_at, 
        metodo_pago, 
        total, 
        costo_total, 
        (total - costo_total) as margen 
      FROM ventas 
      ${dateFilterWhere}
      ORDER BY created_at DESC 
      LIMIT 100
    `, params);

    // Ranking de Proveedores (Mayor deuda)
    const [proveedoresDeudaRows] = await pool.execute<RowDataPacket[]>(`
      SELECT p.nombre, SUM(fp.saldo) as total_deuda 
      FROM facturas_proveedores fp 
      JOIN proveedores p ON fp.proveedor_id = p.id 
      WHERE fp.estado != 'pagada' 
      GROUP BY p.id 
      ORDER BY total_deuda DESC 
      LIMIT 5
    `);

    return {
      graficas: {
        ingresosEgresos: ingresosEgresosRows,
        ventasPorDia: ventasDiaRows,
        topProductos: topProductosRows,
        metodosPago: metodosPagoRows,
        flujoCaja: flujoCajaRows,
        horasPico: horasPicoRows,
      },
      listas: {
        topMargen: topMargenRows,
        margenPorDia: margenPorDiaRows,
        historialVentas: historialVentasRows,
        proveedoresDeuda: proveedoresDeudaRows,
      }
    };
  }
}
