import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";

const cancelSchema = z.object({
  cajaTurnoId: z.number().int().positive(),
  motivo: z.string().default("Anulación de cobro")
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = Number(params.id);
    if (!id || id <= 0) return Response.json({ error: "ID inválido" }, { status: 400 });

    const input = cancelSchema.parse(await request.json());
    const pool = getMysqlPool();
    const connection = await pool.getConnection();

    try {
       await connection.beginTransaction();

       // 1. Verificar Caja
       const [cashRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM caja_turnos WHERE id = ? AND estado = 'abierta' FOR UPDATE", [input.cajaTurnoId]);
       if (!cashRows[0]) throw new Error("Turno de caja cerrado o inexistente");

       // 2. Verificar Cuenta por Cobrar
       const [cuentaRows] = await connection.execute<RowDataPacket[]>("SELECT id, monto_original, saldo, estado FROM cuentas_por_cobrar WHERE id = ? FOR UPDATE", [id]);
       if (!cuentaRows[0]) throw new Error("Cuenta por cobrar no encontrada");
       const cuenta = cuentaRows[0];
       if (cuenta.estado !== "pagada") throw new Error("La cuenta no está pagada");

       // 3. Buscar el abono (el último o la suma)
       const [abonosRows] = await connection.execute<RowDataPacket[]>("SELECT SUM(monto) as total_abonos FROM abonos_clientes WHERE cuenta_por_cobrar_id = ?", [id]);
       const montoAbonado = Number(abonosRows[0].total_abonos || 0);

       // 4. Restaurar cuenta a estado original o pendiente (saldo = monto original por simplicidad, o borrar los abonos y calcular)
       // Para anular completamente:
       await connection.execute("DELETE FROM abonos_clientes WHERE cuenta_por_cobrar_id = ?", [id]);
       await connection.execute("UPDATE cuentas_por_cobrar SET saldo = monto_original, estado = 'pendiente' WHERE id = ?", [id]);

       // 5. Retiro en caja (Anulación)
       await connection.execute("INSERT INTO movimientos_caja (caja_turno_id, tipo, metodo_pago, monto, concepto) VALUES (?, 'retiro', 'efectivo', ?, ?)", [input.cajaTurnoId, montoAbonado, input.motivo]);

       await connection.commit();
       return Response.json({ success: true, cuentaRestaurada: id });

    } catch(err) {
       await connection.rollback();
       throw err;
    } finally {
       connection.release();
    }
  } catch (error) {
    return errorResponse(error);
  }
}
