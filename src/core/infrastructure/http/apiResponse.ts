import { DomainError } from "@/core/domain/errors";

export function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    const status = error.code === "NOT_FOUND" ? 404 : (error.code === "CONFLICT" || error.code === "INSUFFICIENT_STOCK") ? 409 : 400;
    return Response.json({ error: error.message, code: error.code }, { status });
  }

  if (error instanceof Error) {
    if (error.message.includes("cerrad") || error.message.includes("insuficiente")) {
      return Response.json({ error: error.message, code: "CONFLICT" }, { status: 409 });
    }
  }

  console.error(error);
  return Response.json({ error: error instanceof Error ? error.message : "Error interno del servidor" }, { status: 500 });
}
