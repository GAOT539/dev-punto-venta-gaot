import { errorResponse } from "@/core/infrastructure/http/apiResponse";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = Number(params.id);
    if (!id || id <= 0) return Response.json({ error: "ID inválido" }, { status: 400 });

    const pool = await import("@/core/infrastructure/database/mysqlConnection").then(m => m.getMysqlPool());
    
    const [detalles] = await pool.execute(`
      SELECT vd.id, vd.cantidad, vd.precio_unitario, vd.subtotal, v.nombre as producto_nombre, v.sku
      FROM venta_detalles vd
      JOIN variantes_producto v ON vd.variante_id = v.id
      WHERE vd.venta_id = ?
    `, [id]);

    return Response.json({ detalles });
  } catch (error) {
    return errorResponse(error);
  }
}
