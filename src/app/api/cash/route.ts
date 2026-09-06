import { z } from "zod";
import { AperturarCajaUseCase, CerrarCajaUseCase, RegistrarMovimientoManualUseCase } from "@/core/application/use-cases/cashUseCases";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlCashRegisterRepository } from "@/core/infrastructure/repositories/mysqlCashRegisterRepository";

const cash = new MysqlCashRegisterRepository();
const openSchema = z.object({ montoInicial: z.number().nonnegative() });
const closeSchema = z.object({ id: z.number().int().positive(), efectivoReal: z.number().nonnegative() });
const movementSchema = z.object({ cajaTurnoId: z.number().int().positive(), tipo: z.enum(["ingreso", "retiro"]), monto: z.number().positive(), concepto: z.string().trim().min(1) });

export async function GET() {
  try { return Response.json({ caja: await cash.findOpen() }); } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "open") return Response.json(await new AperturarCajaUseCase(cash).execute(openSchema.parse(body).montoInicial), { status: 201 });
    if (body.action === "close") { const input = closeSchema.parse(body); return Response.json(await new CerrarCajaUseCase(cash).execute(input.id, input.efectivoReal)); }
    const input = movementSchema.parse(body);
    return Response.json(await new RegistrarMovimientoManualUseCase(cash).execute(input), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
