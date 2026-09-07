import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { RowDataPacket } from "mysql2/promise";

export class MysqlDashboardRepository {
  async getDashboardData() {
    const pool = getMysqlPool();
    // Ventas totales del mes (o de los últimos 30 días)
    const [mesRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) + 
        (SELECT COALESCE(SUM(monto), 0) FROM movimientos_caja WHERE tipo = 'ingreso' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS total
    `);
    
    // Estado del Inventario
    const [invRows] = await pool.execute<RowDataPacket[]>("SELECT COALESCE(SUM(precio_venta * stock_actual), 0) AS valor_inventario FROM variantes_producto WHERE activo = TRUE AND stock_actual > 0");

    // Historial de Ventas por Día con cruce de movimientos y margen
    const [rankingRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        v.fecha, 
        v.total_ventas + COALESCE(i.total_ingresos, 0) as total_ventas, 
        v.cantidad_ventas,
        COALESCE(m.total_egresos, 0) as total_egresos,
        ((v.total_ventas + COALESCE(i.total_ingresos, 0)) - COALESCE(m.total_egresos, 0)) as total_neto,
        v.margen_ventas
      FROM (
        SELECT DATE(created_at) as fecha, SUM(total) as total_ventas, COUNT(*) as cantidad_ventas, SUM(total - costo_total) as margen_ventas 
        FROM ventas GROUP BY DATE(created_at)
      ) v
      LEFT JOIN (
        SELECT DATE(created_at) as fecha, SUM(monto) as total_egresos 
        FROM movimientos_caja WHERE tipo = 'retiro' GROUP BY DATE(created_at)
      ) m ON v.fecha = m.fecha
      LEFT JOIN (
        SELECT DATE(created_at) as fecha, SUM(monto) as total_ingresos 
        FROM movimientos_caja WHERE tipo = 'ingreso' GROUP BY DATE(created_at)
      ) i ON v.fecha = i.fecha
      ORDER BY v.fecha DESC
    `);

    // Desglose del Día
    const [desgloseRows] = await pool.execute<RowDataPacket[]>(`
      SELECT metodo_pago, SUM(total) as total
      FROM ventas WHERE DATE(created_at) = CURDATE()
      GROUP BY metodo_pago
    `);

    // Egresos del mes y hoy
    const [egresosMesRows] = await pool.execute<RowDataPacket[]>("SELECT COALESCE(SUM(monto), 0) AS total FROM movimientos_caja WHERE tipo = 'retiro' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    const [egresosHoyRows] = await pool.execute<RowDataPacket[]>("SELECT COALESCE(SUM(monto), 0) AS total FROM movimientos_caja WHERE tipo = 'retiro' AND DATE(created_at) = CURDATE()");
    
    // Cuentas por pagar pendientes
    const [cxpRows] = await pool.execute<RowDataPacket[]>("SELECT COALESCE(SUM(saldo), 0) AS total FROM facturas_proveedores WHERE estado != 'pagada'");

    return {
      ventasTotalesMes: Number(mesRows[0]?.total || 0),
      egresosTotalesMes: Number(egresosMesRows[0]?.total || 0),
      egresosHoy: Number(egresosHoyRows[0]?.total || 0),
      valorInventario: Number(invRows[0]?.valor_inventario || 0),
      cuentasPorPagar: Number(cxpRows[0]?.total || 0),
      rankingMejoresDias: rankingRows.map((r) => ({
        fecha: r.fecha,
        total: Number(r.total_ventas),
        cantidad: Number(r.cantidad_ventas),
        egresos: Number(r.total_egresos),
        neto: Number(r.total_neto),
        margen: Number(r.margen_ventas)
      })),
      desgloseHoy: desgloseRows.map((r) => ({ metodo: r.metodo_pago, total: Number(r.total) }))
    };
  }
}
