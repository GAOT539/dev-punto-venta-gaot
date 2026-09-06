import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { CustomerCreditRepository, ReceivableAccount } from "@/core/domain/ports";
import type { PaymentMethod } from "@/core/domain/entities";

interface AccountRow extends RowDataPacket {
  id: number; cliente_nombre: string; cliente_identificacion: string | null; referencia: string;
  monto_original: number; saldo: number; fecha_vencimiento: string | null; estado: ReceivableAccount["estado"];
}
function mapAccount(row: AccountRow): ReceivableAccount {
  return { id: row.id, clienteNombre: row.cliente_nombre, clienteIdentificacion: row.cliente_identificacion, referencia: row.referencia, montoOriginal: Number(row.monto_original), saldo: Number(row.saldo), fechaVencimiento: row.fecha_vencimiento, estado: row.estado };
}

export class MysqlReceivablesRepository implements CustomerCreditRepository {
  async createCredit(input: { clienteNombre: string; clienteIdentificacion?: string; referencia: string; monto: number; fechaVencimiento?: string }): Promise<ReceivableAccount> {
    const [result] = await getMysqlPool().execute<ResultSetHeader>("INSERT INTO cuentas_por_cobrar (cliente_nombre, cliente_identificacion, referencia, monto_original, saldo, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?)", [input.clienteNombre.trim(), input.clienteIdentificacion?.trim() || null, input.referencia.trim(), input.monto, input.monto, input.fechaVencimiento || null]);
    const account = await this.findById(result.insertId);
    if (!account) throw new Error("No se pudo crear la cuenta por cobrar");
    return account;
  }

  async addPayment(input: { cuentaId: number; monto: number; metodoPago: PaymentMethod; cajaTurnoId: number }): Promise<ReceivableAccount> {
    const connection = await getMysqlPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<AccountRow[]>("SELECT * FROM cuentas_por_cobrar WHERE id = ? FOR UPDATE", [input.cuentaId]);
      const account = rows[0];
      if (!account) throw new Error("Cuenta por cobrar no encontrada");
      if (input.monto > Number(account.saldo)) throw new Error("El abono supera el saldo deudor");
      const newBalance = Number(account.saldo) - input.monto;
      await connection.execute("INSERT INTO abonos_clientes (cuenta_por_cobrar_id, monto, metodo_pago) VALUES (?, ?, ?)", [input.cuentaId, input.monto, input.metodoPago]);
      await connection.execute("UPDATE cuentas_por_cobrar SET saldo = ?, estado = ? WHERE id = ?", [newBalance, newBalance === 0 ? "pagada" : "pendiente", input.cuentaId]);
      
      if (input.cajaTurnoId) {
         await connection.execute("INSERT INTO movimientos_caja (caja_turno_id, tipo, metodo_pago, monto, concepto) VALUES (?, 'ingreso', ?, ?, ?)", [input.cajaTurnoId, input.metodoPago, input.monto, `Abono de cliente (Cuenta #${input.cuentaId})`]);
      }
      
      await connection.commit();
      const updated = await this.findById(input.cuentaId);
      if (!updated) throw new Error("No se pudo consultar la cuenta actualizada");
      return updated;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  async findById(id: number): Promise<ReceivableAccount | null> {
    const [rows] = await getMysqlPool().execute<AccountRow[]>("SELECT * FROM cuentas_por_cobrar WHERE id = ?", [id]);
    return rows[0] ? mapAccount(rows[0]) : null;
  }

  async list(): Promise<ReceivableAccount[]> {
    const [rows] = await getMysqlPool().execute<AccountRow[]>("SELECT * FROM cuentas_por_cobrar WHERE saldo > 0 ORDER BY fecha_vencimiento IS NULL, fecha_vencimiento ASC, cliente_nombre ASC");
    return rows.map(mapAccount);
  }
}
