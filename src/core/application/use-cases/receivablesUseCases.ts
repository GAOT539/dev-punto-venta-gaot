import { NotFoundError, ValidationError } from "@/core/domain/errors";
import type { PaymentMethod } from "@/core/domain/entities";
import type { CustomerCreditRepository } from "@/core/domain/ports";

export class RegistrarCreditoClienteUseCase {
  constructor(private readonly accounts: CustomerCreditRepository) {}

  execute(input: { clienteNombre: string; clienteIdentificacion?: string; referencia: string; monto: number; fechaVencimiento?: string }) {
    if (!input.clienteNombre.trim() || !input.referencia.trim() || input.monto <= 0) {
      throw new ValidationError("Cliente, referencia y monto son obligatorios");
    }
    return this.accounts.createCredit(input);
  }
}

export class RegistrarAbonoClienteUseCase {
  constructor(private readonly accounts: CustomerCreditRepository) {}

  execute(input: { cuentaId: number; monto: number; metodoPago: PaymentMethod; cajaTurnoId: number }) {
    if (!Number.isInteger(input.cuentaId) || input.monto <= 0) {
      throw new ValidationError("La cuenta y el monto del abono son inválidos");
    }
    if (!input.cajaTurnoId) throw new ValidationError("Se requiere un turno de caja abierto");
    return this.accounts.addPayment(input);
  }
}

export class CalcularSaldoDeudorUseCase {
  constructor(private readonly accounts: CustomerCreditRepository) {}

  async execute(id: number) {
    const account = await this.accounts.findById(id);
    if (!account) throw new NotFoundError("Cuenta por cobrar no encontrada");
    return { cuenta: account, saldo: account.saldo };
  }
}

export class ListarCuentasPorCobrarUseCase {
  constructor(private readonly accounts: CustomerCreditRepository) {}
  execute() { return this.accounts.list(); }
}
