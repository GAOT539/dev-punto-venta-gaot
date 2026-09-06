import { ValidationError } from "@/core/domain/errors";
import type { SaleInput, SaleSummary } from "@/core/domain/entities";
import type { SaleRepository } from "@/core/domain/ports";

export class RegistrarVentaUseCase {
  constructor(private readonly sales: SaleRepository) {}

  execute(input: SaleInput): Promise<SaleSummary> {
    if (!Number.isInteger(input.cajaTurnoId) || input.lineas.length === 0) {
      throw new ValidationError("La caja y las líneas de venta son obligatorias");
    }
    if (!["efectivo", "transferencia"].includes(input.metodoPago)) {
      throw new ValidationError("El método de pago no es válido");
    }
    if (input.lineas.some((line) => !Number.isInteger(line.varianteId) || line.cantidad <= 0)) {
      throw new ValidationError("Las cantidades de venta deben ser positivas");
    }

    return this.sales.register(input);
  }
}
