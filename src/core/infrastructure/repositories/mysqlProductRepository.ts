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
  SELECT v.id, v.producto_id, v.sku, v.codigo_barras, COALESCE(v.nombre, p.nombre) AS nombre, v.precio_venta, v.costo,
         v.stock_actual, v.stock_minimo, v.activo
  FROM variantes_producto v
  JOIN productos p ON p.id = v.producto_id
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
        `${variantSelect} WHERE v.id = ?`,
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
      `${variantSelect} WHERE v.id = ? AND v.activo = TRUE`,
      [id],
    );
    return rows[0] ? mapVariant(rows[0]) : null;
  }

  async findByCode(code: string): Promise<ProductVariant | null> {
    const [rows] = await getMysqlPool().execute<ProductVariantRow[]>(
      `${variantSelect} WHERE (v.sku = ? OR v.codigo_barras = ?) AND v.activo = TRUE`,
      [code, code],
    );
    return rows[0] ? mapVariant(rows[0]) : null;
  }

  async search(term: string): Promise<ProductVariant[]> {
    const pattern = `%${term.trim()}%`;
    const [rows] = await getMysqlPool().execute<ProductVariantRow[]>(
      `${variantSelect} WHERE v.activo = TRUE AND (v.sku LIKE ? OR v.codigo_barras LIKE ? OR v.nombre LIKE ? OR p.nombre LIKE ?)
       ORDER BY CASE WHEN v.sku = ? OR v.codigo_barras = ? THEN 0 ELSE 1 END, p.nombre ASC LIMIT 12`,
      [pattern, pattern, pattern, pattern, term.trim(), term.trim()],
    );
    return rows.map(mapVariant);
  }

  async listLowStock(): Promise<ProductVariant[]> {
    const [rows] = await getMysqlPool().execute<ProductVariantRow[]>(
      `${variantSelect} WHERE v.activo = TRUE AND v.stock_actual <= v.stock_minimo ORDER BY v.stock_actual ASC, nombre ASC`,
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
