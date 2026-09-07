import { ValidationError, InsufficientStockError } from "@/core/domain/errors";
import type { SaleInput, SaleSummary } from "@/core/domain/entities";
import type { SaleRepository, ProductRepository } from "@/core/domain/ports";

export class RegistrarVentaUseCase {
  constructor(
    private readonly sales: SaleRepository,
    private readonly products?: ProductRepository
  ) {}

  async execute(input: SaleInput): Promise<SaleSummary> {
    if (!Number.isInteger(input.cajaTurnoId) || input.lineas.length === 0) {
      throw new ValidationError("La caja y las líneas de venta son obligatorias");
    }
    if (!["efectivo", "transferencia", "credito"].includes(input.metodoPago.toLowerCase())) {
      throw new ValidationError("El método de pago no es válido");
    }
    if (input.lineas.some((line) => !Number.isInteger(line.varianteId) || line.cantidad <= 0)) {
      throw new ValidationError("Las cantidades de venta deben ser positivas");
    }

    if (this.products) {
      for (const line of input.lineas) {
        const product = await this.products.findById(line.varianteId);
        if (product && product.stockActual < line.cantidad) {
          throw new InsufficientStockError(`Stock insuficiente para el producto ${product.nombre || product.sku}`);
        }
      }
    }

    return this.sales.register(input);
  }
}
