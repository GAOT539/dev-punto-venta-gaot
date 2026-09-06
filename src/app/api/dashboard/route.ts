import { errorResponse } from "@/core/infrastructure/http/apiResponse";
import { MysqlDashboardRepository } from "@/core/infrastructure/repositories/mysqlDashboardRepository";

const dashboardRepo = new MysqlDashboardRepository();

export async function GET() {
  try {
    const data = await dashboardRepo.getDashboardData();
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
