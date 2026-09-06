import { ValidationError } from "@/core/domain/errors";
import type { PayableRepository } from "@/core/domain/ports";

export class ListarFacturasPorVencerUseCase {
  constructor(private readonly invoices: PayableRepository) {}

  execute(days = 7) {
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      throw new ValidationError("El rango de vencimiento no es válido");
    }
    return this.invoices.listDueBefore(days);
  }
}
