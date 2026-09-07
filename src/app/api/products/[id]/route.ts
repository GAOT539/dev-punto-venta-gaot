import { z } from "zod";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { RowDataPacket } from "mysql2/promise";

const updateSchema = z.object({
  nombre: z.string().trim().min(1),
  categoria: z.string().trim().min(1).optional(),
  proveedorId: z.number().int().positive().optional().nullable(),
  precioVenta: z.number().nonnegative(),
  costo: z.number().nonnegative(),
  stockActual: z.number().nonnegative(),
  stockMinimo: z.number().nonnegative(),
  sku: z.string().trim().optional().or(z.literal(''))
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = Number(params.id);
    if (!id || id <= 0) return Response.json({ error: "ID de variante inválido" }, { status: 400 });

    const input = updateSchema.parse(await request.json());
    const pool = getMysqlPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Encontrar a qué producto pertenece la variante
      const [varianteRows] = await connection.execute<RowDataPacket[]>("SELECT producto_id FROM variantes_producto WHERE id = ? FOR UPDATE", [id]);
      if (!varianteRows.length) throw new Error("Variante no encontrada");
      const productoId = varianteRows[0].producto_id;

      // Actualizar producto principal
      await connection.execute(
        "UPDATE productos SET nombre = ?, categoria = ?, proveedor_id = ? WHERE id = ?",
        [input.nombre, input.categoria || 'General', input.proveedorId || null, productoId]
      );

      let finalSku = input.sku;
      if (!finalSku) {
        finalSku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,5).toUpperCase()}`;
      }

      // Actualizar variante
      await connection.execute(
        "UPDATE variantes_producto SET sku = ?, precio_venta = ?, costo = ?, stock_actual = ?, stock_minimo = ? WHERE id = ?",
        [finalSku, input.precioVenta, input.costo, input.stockActual, input.stockMinimo, id]
      );

      await connection.commit();
      return Response.json({ success: true, id });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = Number(params.id);
    if (!id || id <= 0) return Response.json({ error: "ID de variante inválido" }, { status: 400 });

    const pool = getMysqlPool();
    await pool.execute("UPDATE variantes_producto SET activo = FALSE WHERE id = ?", [id]);
    
    return Response.json({ success: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}
