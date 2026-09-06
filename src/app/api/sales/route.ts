import { z } from "zod";
import { RegistrarVentaUseCase } from "@/core/application/use-cases/salesUseCases";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlSaleRepository } from "@/core/infrastructure/repositories/mysqlSaleRepository";

const saleSchema = z.object({ cajaTurnoId: z.number().int().positive(), metodoPago: z.enum(["efectivo", "transferencia", "credito"]), clienteCredito: z.object({ nombre: z.string().trim().min(1), identificacion: z.string().optional(), fechaVencimiento: z.string().optional() }).optional(), lineas: z.array(z.object({ varianteId: z.number().int().positive(), cantidad: z.number().positive() })).min(1) });

export async function POST(request: Request) {
  try {
    const input = saleSchema.parse(await request.json());
    return Response.json(await new RegistrarVentaUseCase(new MysqlSaleRepository()).execute(input), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
