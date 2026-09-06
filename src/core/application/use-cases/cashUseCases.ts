import { ConflictError, ValidationError } from "@/core/domain/errors";
import type { CashMovement, CashRegister } from "@/core/domain/entities";
import type { CashRegisterRepository } from "@/core/domain/ports";

export class AperturarCajaUseCase {
  constructor(private readonly cash: CashRegisterRepository) {}

  async execute(montoInicial: number): Promise<CashRegister> {
    if (!Number.isFinite(montoInicial) || montoInicial < 0) {
      throw new ValidationError("El monto inicial no es válido");
    }

    if (await this.cash.findOpen()) {
      throw new ConflictError("Ya existe una caja abierta");
    }

    return this.cash.open(montoInicial);
  }
}

export class RegistrarMovimientoManualUseCase {
  constructor(private readonly cash: CashRegisterRepository) {}

  async execute(input: {
    cajaTurnoId: number;
    tipo: "ingreso" | "retiro";
    monto: number;
    concepto: string;
  }): Promise<CashMovement> {
    if (input.monto <= 0 || !input.concepto.trim()) {
      throw new ValidationError("El monto y concepto son obligatorios");
    }

    return this.cash.addMovement(input);
  }
}

export class CerrarCajaUseCase {
  constructor(private readonly cash: CashRegisterRepository) {}

  execute(id: number, efectivoReal: number): Promise<CashRegister> {
    if (!Number.isInteger(id) || efectivoReal < 0) {
      throw new ValidationError("Los datos del cierre no son válidos");
    }

    return this.cash.close(id, efectivoReal);
  }
}
