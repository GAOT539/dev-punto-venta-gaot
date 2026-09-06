import { VerificarAlertasStockUseCase } from "@/core/application/use-cases/inventoryUseCases";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlProductRepository } from "@/core/infrastructure/repositories/mysqlProductRepository";

export async function GET() {
  try {
    const products = await new VerificarAlertasStockUseCase(new MysqlProductRepository()).execute();
    return Response.json({ products });
  } catch (error) {
    return errorResponse(error);
  }
}
