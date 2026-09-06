import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "@/core/infrastructure/database/mysqlConnection";
import type { ProductVariant } from "@/core/domain/entities";
import type { CreateProductInput, ProductRepository } from "@/core/domain/ports";

interface ProductVariantRow extends RowDataPacket {
  id: number;
  producto_id: number;
  sku: string;
  codigo_barras: string | null;
  nombre: string | null;
  precio_venta: number;
  costo: number;
  stock_actual: number;
  stock_minimo: number;
  activo: number;
}

function mapVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    productoId: row.producto_id,
    sku: row.sku,
    codigoBarras: row.codigo_barras,
    nombre: row.nombre,
    precioVenta: Number(row.precio_venta),
    costo: Number(row.costo),
    stockActual: Number(row.stock_actual),
    stockMinimo: Number(row.stock_minimo),
    activo: Boolean(row.activo),
  };
}

const variantSelect = `
  SELECT id, producto_id, sku, codigo_barras, nombre, precio_venta, costo,
         stock_actual, stock_minimo, activo
  FROM variantes_producto
`;

export class MysqlProductRepository implements ProductRepository {
  async create(input: CreateProductInput): Promise<ProductVariant> {
    const connection = await getMysqlPool().getConnection();

    try {
      await connection.beginTransaction();
      const [productResult] = await connection.execute<ResultSetHeader>(
        "INSERT INTO productos (nombre, descripcion) VALUES (?, ?)",
        [input.nombre.trim(), input.descripcion?.trim() || null],
      );
      const [variantResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO variantes_producto
          (producto_id, sku, codigo_barras, nombre, precio_venta, costo, stock_actual, stock_minimo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productResult.insertId,
          input.sku ?? `SKU-${Date.now().toString(36).toUpperCase()}`,
          input.codigoBarras?.trim() || null,
          input.varianteNombre?.trim() || null,
          input.precioVenta,
          input.costo,
          input.stockInicial ?? 0,
          input.stockMinimo ?? 0,
        ],
      );
      await connection.commit();
      const [rows] = await connection.execute<ProductVariantRow[]>(
        `${variantSelect} WHERE id = ?`,
        [variantResult.insertId],
      );
      return mapVariant(rows[0]);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findById(id: number): Promise<ProductVariant | null> {
    const [rows] = await getMysqlPool().execute<ProductVariantRow[]>(
      `${variantSelect} WHERE id = ? AND activo = TRUE`,
      [id],
    );
    return rows[0] ? mapVariant(rows[0]) : null;
  }

  async findByCode(code: string): Promise<ProductVariant | null> {
    const [rows] = await getMysqlPool().execute<ProductVariantRow[]>(
      `${variantSelect} WHERE (sku = ? OR codigo_barras = ?) AND activo = TRUE`,
      [code, code],
    );
    return rows[0] ? mapVariant(rows[0]) : null;
  }

  async listLowStock(): Promise<ProductVariant[]> {
    const [rows] = await getMysqlPool().execute<ProductVariantRow[]>(
      `${variantSelect} WHERE activo = TRUE AND stock_actual <= stock_minimo ORDER BY stock_actual ASC, nombre ASC`,
    );
    return rows.map(mapVariant);
  }

  async adjustStock(id: number, delta: number): Promise<ProductVariant> {
    const [result] = await getMysqlPool().execute<ResultSetHeader>(
      "UPDATE variantes_producto SET stock_actual = stock_actual + ? WHERE id = ? AND stock_actual + ? >= 0",
      [delta, id, delta],
    );
    if (result.affectedRows === 0) {
      throw new Error("Producto inexistente o stock insuficiente");
    }

    const product = await this.findById(id);
    if (!product) {
      throw new Error("Producto inexistente");
    }
    return product;
  }
}
