import { z } from "zod";
import { RegistrarVentaUseCase } from "@/core/application/use-cases/salesUseCases";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlSaleRepository } from "@/core/infrastructure/repositories/mysqlSaleRepository";

const saleSchema = z.object({ cajaTurnoId: z.number().int().positive(), metodoPago: z.enum(["efectivo", "transferencia", "credito", "CREDITO"]), clienteCredito: z.object({ nombre: z.string().trim().min(1), identificacion: z.string().optional(), fechaVencimiento: z.string().optional() }).optional(), lineas: z.array(z.object({ varianteId: z.number().int().positive(), cantidad: z.number().positive() })).min(1) });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateStr = url.searchParams.get("date");
    if (!dateStr) return Response.json({ error: "Parámetro date es requerido (YYYY-MM-DD)" }, { status: 400 });

    const pool = await import("@/core/infrastructure/database/mysqlConnection").then(m => m.getMysqlPool());
    
    // Ventas del día
    const [ventasRows] = await pool.execute("SELECT id, caja_turno_id, metodo_pago, subtotal, total, created_at FROM ventas WHERE DATE(created_at) = ?", [dateStr]);
    
    // Movimientos del día
    const [movimientosRows] = await pool.execute("SELECT id, caja_turno_id, tipo, metodo_pago, monto, concepto, created_at FROM movimientos_caja WHERE DATE(created_at) = ?", [dateStr]);

    return Response.json({
      ventas: ventasRows,
      movimientos: movimientosRows
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = saleSchema.parse(await request.json());
    return Response.json(await new RegistrarVentaUseCase(new MysqlSaleRepository()).execute(input), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
