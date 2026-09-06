import { z } from "zod";
import { CrearProductoUseCase } from "@/core/application/use-cases/inventoryUseCases";
import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlProductRepository } from "@/core/infrastructure/repositories/mysqlProductRepository";

const productSchema = z.object({
  nombre: z.string().trim().min(1),
  descripcion: z.string().optional(),
  sku: z.string().trim().min(1).optional(),
  codigoBarras: z.string().trim().min(1).optional(),
  varianteNombre: z.string().optional(),
  precioVenta: z.number().nonnegative(),
  costo: z.number().nonnegative(),
  stockInicial: z.number().nonnegative().optional(),
  stockMinimo: z.number().nonnegative().optional(),
});

const repository = new MysqlProductRepository();

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get("code");
    if (!code?.trim()) {
      return Response.json({ products: await repository.getAll() });
    }

    const term = code.trim();
    const product = await repository.findByCode(term);
    if (product) return Response.json(product);
    return Response.json({ products: await repository.search(term) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = productSchema.parse(await request.json());
    const product = await new CrearProductoUseCase(repository).execute(input);
    return Response.json(product, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
