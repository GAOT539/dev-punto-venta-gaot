import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { RowDataPacket } from "mysql2/promise";

export async function GET() {
  try {
    const pool = getMysqlPool();
    // Ventas totales del mes (o de los últimos 30 días)
    const [mesRows] = await pool.execute<RowDataPacket[]>("SELECT COALESCE(SUM(total), 0) AS total FROM ventas WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    
    // Estado del Inventario (Suma de precio_venta * stock_actual)
    const [invRows] = await pool.execute<RowDataPacket[]>("SELECT COALESCE(SUM(precio_venta * stock_actual), 0) AS valor_inventario FROM variantes_producto WHERE activo = TRUE AND stock_actual > 0");

    // Mejores días de venta
    const [rankingRows] = await pool.execute<RowDataPacket[]>("SELECT DATE(created_at) as fecha, SUM(total) as total_ventas, COUNT(*) as cantidad_ventas FROM ventas GROUP BY DATE(created_at) ORDER BY total_ventas DESC LIMIT 5");

    return Response.json({
      ventasTotalesMes: Number(mesRows[0]?.total || 0),
      valorInventario: Number(invRows[0]?.valor_inventario || 0),
      rankingMejoresDias: rankingRows.map((r) => ({
        fecha: r.fecha,
        total: Number(r.total_ventas),
        cantidad: Number(r.cantidad_ventas)
      }))
    });
  } catch (error) {
    return errorResponse(error);
  }
}
