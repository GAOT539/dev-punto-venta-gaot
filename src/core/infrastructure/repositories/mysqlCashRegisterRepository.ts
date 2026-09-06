import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { CashMovement, CashRegister } from "@/core/domain/entities";
import type { CashRegisterRepository } from "@/core/domain/ports";

interface CashRow extends RowDataPacket {
  id: number;
  fecha_apertura: Date;
  fecha_cierre: Date | null;
  monto_inicial: number;
  efectivo_esperado: number | null;
  efectivo_real: number | null;
  diferencia: number | null;
  estado: "abierta" | "cerrada";
}

function mapCash(row: CashRow): CashRegister {
  return { id: row.id, fechaApertura: row.fecha_apertura, fechaCierre: row.fecha_cierre, montoInicial: Number(row.monto_inicial), efectivoEsperado: row.efectivo_esperado === null ? null : Number(row.efectivo_esperado), efectivoReal: row.efectivo_real === null ? null : Number(row.efectivo_real), diferencia: row.diferencia === null ? null : Number(row.diferencia), estado: row.estado };
}

export class MysqlCashRegisterRepository implements CashRegisterRepository {
  async findOpen(): Promise<CashRegister | null> {
    const [rows] = await getMysqlPool().execute<CashRow[]>("SELECT * FROM caja_turnos WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1");
    return rows[0] ? mapCash(rows[0]) : null;
  }

  async open(montoInicial: number): Promise<CashRegister> {
    const [result] = await getMysqlPool().execute<ResultSetHeader>("INSERT INTO caja_turnos (monto_inicial) VALUES (?)", [montoInicial]);
    const [rows] = await getMysqlPool().execute<CashRow[]>("SELECT * FROM caja_turnos WHERE id = ?", [result.insertId]);
    return mapCash(rows[0]);
  }

  async addMovement(input: { cajaTurnoId: number; tipo: "ingreso" | "retiro" | "venta"; monto: number; concepto: string; metodoPago?: "efectivo" | "transferencia" }): Promise<CashMovement> {
    const [result] = await getMysqlPool().execute<ResultSetHeader>("INSERT INTO movimientos_caja (caja_turno_id, tipo, metodo_pago, monto, concepto) VALUES (?, ?, ?, ?, ?)", [input.cajaTurnoId, input.tipo, input.metodoPago ?? null, input.monto, input.concepto]);
    return { id: result.insertId, cajaTurnoId: input.cajaTurnoId, tipo: input.tipo, metodoPago: input.metodoPago ?? null, monto: input.monto, concepto: input.concepto, createdAt: new Date() };
  }

  async close(id: number, efectivoReal: number): Promise<CashRegister> {
    const [result] = await getMysqlPool().execute<ResultSetHeader>(`UPDATE caja_turnos c SET estado = 'cerrada', fecha_cierre = NOW(), efectivo_esperado = c.monto_inicial + COALESCE((SELECT SUM(CASE WHEN tipo = 'retiro' THEN -monto ELSE monto END) FROM movimientos_caja WHERE caja_turno_id = c.id AND (tipo = 'ingreso' OR tipo = 'retiro' OR (tipo = 'venta' AND metodo_pago = 'efectivo'))), 0), efectivo_real = ?, diferencia = ? - (c.monto_inicial + COALESCE((SELECT SUM(CASE WHEN tipo = 'retiro' THEN -monto ELSE monto END) FROM movimientos_caja WHERE caja_turno_id = c.id AND (tipo = 'ingreso' OR tipo = 'retiro' OR (tipo = 'venta' AND metodo_pago = 'efectivo'))), 0)) WHERE c.id = ? AND c.estado = 'abierta'`, [efectivoReal, efectivoReal, id]);
    if (result.affectedRows === 0) throw new Error("La caja no existe o ya está cerrada");
    const [rows] = await getMysqlPool().execute<CashRow[]>("SELECT * FROM caja_turnos WHERE id = ?", [id]);
    return mapCash(rows[0]);
  }
}
