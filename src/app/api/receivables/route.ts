import { z } from "zod";
import { CalcularSaldoDeudorUseCase, ListarCuentasPorCobrarUseCase, RegistrarAbonoClienteUseCase, RegistrarCreditoClienteUseCase } from "@/core/application/use-cases/receivablesUseCases";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlReceivablesRepository } from "@/core/infrastructure/repositories/mysqlReceivablesRepository";

const repository = new MysqlReceivablesRepository();
const creditSchema = z.object({ clienteNombre: z.string().trim().min(1), clienteIdentificacion: z.string().optional(), referencia: z.string().trim().min(1), monto: z.number().positive(), fechaVencimiento: z.string().optional() });
const paymentSchema = z.object({ cuentaId: z.number().int().positive(), monto: z.number().positive(), metodoPago: z.enum(["efectivo", "transferencia"]) });

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) return Response.json(await new CalcularSaldoDeudorUseCase(repository).execute(Number(id)));
    return Response.json({ accounts: await new ListarCuentasPorCobrarUseCase(repository).execute() });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "payment") return Response.json(await new RegistrarAbonoClienteUseCase(repository).execute(paymentSchema.parse(body)));
    return Response.json(await new RegistrarCreditoClienteUseCase(repository).execute(creditSchema.parse(body)), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
