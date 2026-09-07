import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlReportsRepository } from "@/core/infrastructure/repositories/mysqlReportsRepository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    
    const repo = new MysqlReportsRepository();
    const data = await repo.getReportsData(from, to);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
