import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import { InsufficientStockError, NotFoundError } from "@/core/domain/errors";
import type { SaleInput, SaleSummary } from "@/core/domain/entities";
import type { SaleRepository } from "@/core/domain/ports";

import Decimal from "decimal.js";

interface VariantRow extends RowDataPacket { id: number; precio_venta: number; costo: number; stock_actual: number; }

export class MysqlSaleRepository implements SaleRepository {
  async register(input: SaleInput): Promise<SaleSummary> {
    const connection = await getMysqlPool().getConnection();
    try {
      await connection.beginTransaction();
      const [cashRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM caja_turnos WHERE id = ? AND estado = 'abierta' FOR UPDATE", [input.cajaTurnoId]);
      if (!cashRows[0]) throw new Error("La caja no existe o está cerrada");
      
      let subtotal = new Decimal(0);
      let costoTotal = new Decimal(0);
      const lines: Array<{ id: number; quantity: number; price: number; cost: number; lineTotal: number }> = [];

      // Agrupar variantes para evitar restar doble y sumar correctos
      const lineMap = new Map<number, number>();
      for (const line of input.lineas) {
        lineMap.set(line.varianteId, (lineMap.get(line.varianteId) || 0) + line.cantidad);
      }
      
      // Ordenar matemáticamente asc por ID para evitar deadlocks
      const uniqueLines = Array.from(lineMap.entries()).sort((a,b) => a[0] - b[0]);

      for (const [varianteId, cantidad] of uniqueLines) {
        const [rows] = await connection.execute<VariantRow[]>("SELECT id, precio_venta, costo, stock_actual FROM variantes_producto WHERE id = ? AND activo = TRUE FOR UPDATE", [varianteId]);
        const variant = rows[0];
        if (!variant) throw new NotFoundError(`Variante ${varianteId} no encontrada`);
        
        // Validar estrictamente > 0
        const stockActualDec = new Decimal(variant.stock_actual);
        const stockResultante = stockActualDec.minus(cantidad);
        if (stockResultante.isNegative()) throw new InsufficientStockError(`Stock insuficiente para la variante ${varianteId}`);
        
        const lineTotal = new Decimal(variant.precio_venta).times(cantidad);
        subtotal = subtotal.plus(lineTotal);
        costoTotal = costoTotal.plus(new Decimal(variant.costo).times(cantidad));
        lines.push({ id: variant.id, quantity: cantidad, price: Number(variant.precio_venta), cost: Number(variant.costo), lineTotal: lineTotal.toNumber() });
      }
      let creditId: number | null = null;
      const normalizedPayment = input.metodoPago.toLowerCase();
      
      const numSubtotal = subtotal.toNumber();
      const numCosto = costoTotal.toNumber();

      if (normalizedPayment === "credito") {
        if (!input.clienteCredito?.nombre?.trim()) throw new Error("El cliente es obligatorio para una venta a crédito");
        const [creditResult] = await connection.execute<ResultSetHeader>("INSERT INTO cuentas_por_cobrar (cliente_nombre, cliente_identificacion, referencia, monto_original, saldo, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?)", [input.clienteCredito.nombre.trim(), input.clienteCredito.identificacion?.trim() || null, "Venta pendiente", numSubtotal, numSubtotal, input.clienteCredito.fechaVencimiento || null]);
        creditId = creditResult.insertId;
      }
      
      const [saleResult] = await connection.execute<ResultSetHeader>("INSERT INTO ventas (caja_turno_id, metodo_pago, cuenta_por_cobrar_id, subtotal, total, costo_total) VALUES (?, ?, ?, ?, ?, ?)", [input.cajaTurnoId, normalizedPayment, creditId, numSubtotal, numSubtotal, numCosto]);
      
      for (const line of lines) {
        await connection.execute("INSERT INTO venta_detalles (venta_id, variante_id, cantidad, precio_unitario, costo_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)", [saleResult.insertId, line.id, line.quantity, line.price, line.cost, line.lineTotal]);
        await connection.execute("UPDATE variantes_producto SET stock_actual = stock_actual - ? WHERE id = ?", [line.quantity, line.id]);
      }
      if (normalizedPayment !== "credito") {
        await connection.execute("INSERT INTO movimientos_caja (caja_turno_id, tipo, metodo_pago, monto, concepto) VALUES (?, 'venta', ?, ?, ?)", [input.cajaTurnoId, normalizedPayment, numSubtotal, `Venta #${saleResult.insertId}`]);
      }
      await connection.commit();
      return { id: saleResult.insertId, subtotal: numSubtotal, total: numSubtotal, costoTotal: numCosto };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getDailyOperations(dateStr: string) {
    const pool = getMysqlPool();
    const [ventasRows] = await pool.execute("SELECT id, caja_turno_id, metodo_pago, subtotal, total, created_at FROM ventas WHERE DATE(created_at) = ?", [dateStr]);
    const [movimientosRows] = await pool.execute("SELECT id, caja_turno_id, tipo, metodo_pago, monto, concepto, created_at FROM movimientos_caja WHERE DATE(created_at) = ?", [dateStr]);
    return { ventas: ventasRows, movimientos: movimientosRows };
  }
}
