import { z } from "zod";
import { RegistrarVentaUseCase } from "@/core/application/use-cases/salesUseCases";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlSaleRepository } from "@/core/infrastructure/repositories/mysqlSaleRepository";

import { MysqlProductRepository } from "@/core/infrastructure/repositories/mysqlProductRepository";

const saleSchema = z.object({ cajaTurnoId: z.number().int().positive(), metodoPago: z.enum(["efectivo", "transferencia", "credito"]), clienteCredito: z.object({ nombre: z.string().trim().min(1), identificacion: z.string().optional(), fechaVencimiento: z.string().optional() }).optional(), lineas: z.array(z.object({ varianteId: z.number().int().positive(), cantidad: z.number().positive() })).min(1) });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateStr = url.searchParams.get("date");
    if (!dateStr) return Response.json({ error: "Parámetro date es requerido (YYYY-MM-DD)" }, { status: 400 });

    const repo = new MysqlSaleRepository();
    const data = await repo.getDailyOperations(dateStr);
    
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = saleSchema.parse(await request.json());
    return Response.json(await new RegistrarVentaUseCase(new MysqlSaleRepository(), new MysqlProductRepository()).execute(input), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
