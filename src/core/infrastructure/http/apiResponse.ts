import { DomainError } from "@/core/domain/errors";

export function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
    return Response.json({ error: error.message, code: error.code }, { status });
  }

  console.error(error);
  return Response.json({ error: "Error interno del servidor" }, { status: 500 });
}
