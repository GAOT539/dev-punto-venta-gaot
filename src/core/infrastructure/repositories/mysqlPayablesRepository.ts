import type { RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { PayableInvoice, PayableRepository } from "@/core/domain/ports";

interface InvoiceRow extends RowDataPacket { id: number; proveedor_nombre: string; numero_factura: string; saldo: number; fecha_vencimiento: string; estado: PayableInvoice["estado"]; }
export class MysqlPayablesRepository implements PayableRepository {
  async listDueBefore(days: number): Promise<PayableInvoice[]> {
    const [rows] = await getMysqlPool().execute<InvoiceRow[]>("SELECT f.id, p.nombre AS proveedor_nombre, f.numero_factura, f.saldo, f.fecha_vencimiento, f.estado FROM facturas_proveedores f JOIN proveedores p ON p.id = f.proveedor_id WHERE f.saldo > 0 AND f.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY) ORDER BY f.fecha_vencimiento ASC", [days]);
    return rows.map((row) => ({ id: row.id, proveedorNombre: row.proveedor_nombre, numeroFactura: row.numero_factura, saldo: Number(row.saldo), fechaVencimiento: row.fecha_vencimiento, estado: row.estado }));
  }
}
