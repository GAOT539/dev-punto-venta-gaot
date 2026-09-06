import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import { InsufficientStockError, NotFoundError } from "@/core/domain/errors";
import type { SaleInput, SaleSummary } from "@/core/domain/entities";
import type { SaleRepository } from "@/core/domain/ports";

interface VariantRow extends RowDataPacket { id: number; precio_venta: number; costo: number; stock_actual: number; }

export class MysqlSaleRepository implements SaleRepository {
  async register(input: SaleInput): Promise<SaleSummary> {
    const connection = await getMysqlPool().getConnection();
    try {
      await connection.beginTransaction();
      const [cashRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM caja_turnos WHERE id = ? AND estado = 'abierta' FOR UPDATE", [input.cajaTurnoId]);
      if (!cashRows[0]) throw new Error("La caja no existe o está cerrada");
      let subtotal = 0;
      let costoTotal = 0;
      const lines: Array<{ id: number; quantity: number; price: number; cost: number; lineTotal: number }> = [];
      for (const line of input.lineas) {
        const [rows] = await connection.execute<VariantRow[]>("SELECT id, precio_venta, costo, stock_actual FROM variantes_producto WHERE id = ? AND activo = TRUE FOR UPDATE", [line.varianteId]);
        const variant = rows[0];
        if (!variant) throw new NotFoundError(`Variante ${line.varianteId} no encontrada`);
        if (Number(variant.stock_actual) < line.cantidad) throw new InsufficientStockError(`Stock insuficiente para la variante ${line.varianteId}`);
        const lineTotal = Number(variant.precio_venta) * line.cantidad;
        subtotal += lineTotal;
        costoTotal += Number(variant.costo) * line.cantidad;
        lines.push({ id: variant.id, quantity: line.cantidad, price: Number(variant.precio_venta), cost: Number(variant.costo), lineTotal });
      }
      let creditId: number | null = null;
      if (input.metodoPago === "credito") {
        if (!input.clienteCredito?.nombre?.trim()) throw new Error("El cliente es obligatorio para una venta a crédito");
        const [creditResult] = await connection.execute<ResultSetHeader>("INSERT INTO cuentas_por_cobrar (cliente_nombre, cliente_identificacion, referencia, monto_original, saldo, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?)", [input.clienteCredito.nombre.trim(), input.clienteCredito.identificacion?.trim() || null, "Venta pendiente", subtotal, subtotal, input.clienteCredito.fechaVencimiento || null]);
        creditId = creditResult.insertId;
      }
      const [saleResult] = await connection.execute<ResultSetHeader>("INSERT INTO ventas (caja_turno_id, metodo_pago, cuenta_por_cobrar_id, subtotal, total, costo_total) VALUES (?, ?, ?, ?, ?, ?)", [input.cajaTurnoId, input.metodoPago, creditId, subtotal, subtotal, costoTotal]);
      for (const line of lines) {
        await connection.execute("INSERT INTO venta_detalles (venta_id, variante_id, cantidad, precio_unitario, costo_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)", [saleResult.insertId, line.id, line.quantity, line.price, line.cost, line.lineTotal]);
        await connection.execute("UPDATE variantes_producto SET stock_actual = stock_actual - ? WHERE id = ?", [line.quantity, line.id]);
      }
      if (input.metodoPago !== "credito") {
        await connection.execute("INSERT INTO movimientos_caja (caja_turno_id, tipo, metodo_pago, monto, concepto) VALUES (?, 'venta', ?, ?, ?)", [input.cajaTurnoId, input.metodoPago, subtotal, `Venta #${saleResult.insertId}`]);
      }
      await connection.commit();
      return { id: saleResult.insertId, subtotal, total: subtotal, costoTotal };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
