import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { RowDataPacket } from "mysql2/promise";

export class MysqlDashboardRepository {
  async getDashboardData() {
    const pool = getMysqlPool();
    // Ventas totales del mes (o de los últimos 30 días)
    const [mesRows] = await pool.execute<RowDataPacket[]>("SELECT COALESCE(SUM(total), 0) AS total FROM ventas WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    
    // Estado del Inventario
    const [invRows] = await pool.execute<RowDataPacket[]>("SELECT COALESCE(SUM(precio_venta * stock_actual), 0) AS valor_inventario FROM variantes_producto WHERE activo = TRUE AND stock_actual > 0");

    // Mejores días de venta con cruce de movimientos (Egresos)
    const [rankingRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        v.fecha, 
        v.total_ventas, 
        v.cantidad_ventas,
        COALESCE(m.total_egresos, 0) as total_egresos,
        (v.total_ventas - COALESCE(m.total_egresos, 0)) as total_neto
      FROM (
        SELECT DATE(created_at) as fecha, SUM(total) as total_ventas, COUNT(*) as cantidad_ventas 
        FROM ventas GROUP BY DATE(created_at)
      ) v
      LEFT JOIN (
        SELECT DATE(created_at) as fecha, SUM(monto) as total_egresos 
        FROM movimientos_caja WHERE tipo = 'retiro' GROUP BY DATE(created_at)
      ) m ON v.fecha = m.fecha
      ORDER BY v.total_ventas DESC LIMIT 5
    `);

    // Desglose del Día
    const [desgloseRows] = await pool.execute<RowDataPacket[]>(`
      SELECT metodo_pago, SUM(total) as total
      FROM ventas WHERE DATE(created_at) = CURDATE()
      GROUP BY metodo_pago
    `);

    return {
      ventasTotalesMes: Number(mesRows[0]?.total || 0),
      valorInventario: Number(invRows[0]?.valor_inventario || 0),
      rankingMejoresDias: rankingRows.map((r) => ({
        fecha: r.fecha,
        total: Number(r.total_ventas),
        cantidad: Number(r.cantidad_ventas),
        egresos: Number(r.total_egresos),
        neto: Number(r.total_neto)
      })),
      desgloseHoy: desgloseRows.map((r) => ({ metodo: r.metodo_pago, total: Number(r.total) }))
    };
  }
}
