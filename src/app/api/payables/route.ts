import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";

export async function GET() {
  try {
    const pool = getMysqlPool();
    // Obtener la lista de facturas de proveedores con el nombre del proveedor
    const [facturas] = await pool.execute<RowDataPacket[]>(`
      SELECT fp.id, fp.proveedor_id, p.nombre as proveedor_nombre, fp.numero_factura, fp.monto_original, fp.saldo, fp.fecha_emision, fp.fecha_vencimiento, fp.estado, fp.created_at
      FROM facturas_proveedores fp
      JOIN proveedores p ON p.id = fp.proveedor_id
      ORDER BY fp.created_at DESC
    `);
    
    // Obtener todos los abonos para que el frontend arme el Accordion
    const [abonos] = await pool.execute<RowDataPacket[]>("SELECT * FROM abonos_proveedores ORDER BY created_at DESC");

    return Response.json({ payables: facturas, payments: abonos });
  } catch (error) {
    return errorResponse(error);
  }
}

const paymentSchema = z.object({
  action: z.literal("payment"),
  facturaId: z.number().int().positive(),
  monto: z.number().positive(),
  metodoPago: z.enum(["efectivo", "transferencia"]),
  cajaTurnoId: z.number().int().positive()
});

const createSchema = z.object({
  action: z.literal("create"),
  proveedor: z.string().min(1),
  factura: z.string().min(1),
  monto: z.number().positive()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "payment") {
       const input = paymentSchema.parse(body);
       const pool = getMysqlPool();
       const connection = await pool.getConnection();
       try {
          await connection.beginTransaction();
          
          // Verificar caja
          const [cashRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM caja_turnos WHERE id = ? AND estado = 'abierta' FOR UPDATE", [input.cajaTurnoId]);
          if (!cashRows[0]) throw new Error("Turno de caja cerrado o inexistente");

          // Bloquear factura
          const [facturaRows] = await connection.execute<RowDataPacket[]>("SELECT saldo FROM facturas_proveedores WHERE id = ? FOR UPDATE", [input.facturaId]);
          if (!facturaRows[0]) throw new Error("Factura no encontrada");
          const saldo = Number(facturaRows[0].saldo);
          if (saldo < input.monto) throw new Error("El monto a pagar excede el saldo de la deuda");

          // Registrar abono
          await connection.execute("INSERT INTO abonos_proveedores (factura_proveedor_id, monto, metodo_pago) VALUES (?, ?, ?)", [input.facturaId, input.monto, input.metodoPago]);
          
          // Actualizar saldo
          const nuevoSaldo = saldo - input.monto;
          const nuevoEstado = nuevoSaldo <= 0 ? "pagada" : "pendiente";
          await connection.execute("UPDATE facturas_proveedores SET saldo = ?, estado = ? WHERE id = ?", [nuevoSaldo, nuevoEstado, input.facturaId]);

          // Registrar movimiento en caja
          await connection.execute("INSERT INTO movimientos_caja (caja_turno_id, tipo, metodo_pago, monto, concepto) VALUES (?, 'retiro', ?, ?, ?)", [input.cajaTurnoId, input.metodoPago, input.monto, `Pago a proveedor - Factura #${input.facturaId}`]);

          await connection.commit();
          return Response.json({ success: true, saldoNuevo: nuevoSaldo });
       } catch (error) {
          await connection.rollback();
          throw error;
       } finally {
          connection.release();
       }
    }
    
    if (body.action === "create") {
       const input = createSchema.parse(body);
       const pool = getMysqlPool();
       const connection = await pool.getConnection();
       try {
          await connection.beginTransaction();
          
          let proveedorId;
          const [provRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM proveedores WHERE nombre = ? LIMIT 1", [input.proveedor]);
          if (provRows.length > 0) {
             proveedorId = provRows[0].id;
          } else {
             const [insertProv] = await connection.execute<any>("INSERT INTO proveedores (nombre) VALUES (?)", [input.proveedor]);
             proveedorId = insertProv.insertId;
          }
          
          const today = new Date().toISOString().split('T')[0];
          await connection.execute(
            "INSERT INTO facturas_proveedores (proveedor_id, numero_factura, monto_original, saldo, fecha_emision, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?)", 
            [proveedorId, input.factura, input.monto, input.monto, today, today]
          );
          
          await connection.commit();
          return Response.json({ success: true });
       } catch (error) {
          await connection.rollback();
          throw error;
       } finally {
          connection.release();
       }
    }

    return Response.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
