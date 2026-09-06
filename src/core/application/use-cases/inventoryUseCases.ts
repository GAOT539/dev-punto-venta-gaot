import { ConflictError, ValidationError } from "@/core/domain/errors";
import type { ProductVariant } from "@/core/domain/entities";
import type { CreateProductInput, ProductRepository } from "@/core/domain/ports";

export class CrearProductoUseCase {
  constructor(private readonly products: ProductRepository) {}

  execute(input: CreateProductInput): Promise<ProductVariant> {
    if (!input.nombre.trim()) {
      throw new ValidationError("El nombre del producto es obligatorio");
    }

    if (input.precioVenta < 0 || input.costo < 0) {
      throw new ValidationError("Los precios no pueden ser negativos");
    }

    const sku = input.sku?.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`;
    return this.products.create({ ...input, sku });
  }
}

export class ActualizarStockUseCase {
  constructor(private readonly products: ProductRepository) {}

  execute(id: number, delta: number): Promise<ProductVariant> {
    if (!Number.isInteger(id) || !Number.isFinite(delta) || delta === 0) {
      throw new ValidationError("El producto y la variación de stock son inválidos");
    }

    return this.products.adjustStock(id, delta);
  }
}

export class VerificarAlertasStockUseCase {
  constructor(private readonly products: ProductRepository) {}

  execute(): Promise<ProductVariant[]> {
    return this.products.listLowStock();
  }
}

export function ensureUniqueSkuError(error: unknown): never {
  if (error instanceof Error && error.message.includes("uq_variantes_sku")) {
    throw new ConflictError("El SKU ya existe");
  }

  throw error;
}
