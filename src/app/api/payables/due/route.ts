import { z } from "zod";
import { ListarFacturasPorVencerUseCase } from "@/core/application/use-cases/payablesUseCases";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlPayablesRepository } from "@/core/infrastructure/repositories/mysqlPayablesRepository";

export async function GET(request: Request) {
  try {
    const days = z.coerce.number().int().min(0).max(365).default(7).parse(new URL(request.url).searchParams.get("days") ?? undefined);
    return Response.json({ invoices: await new ListarFacturasPorVencerUseCase(new MysqlPayablesRepository()).execute(days) });
  } catch (error) { return errorResponse(error); }
}
