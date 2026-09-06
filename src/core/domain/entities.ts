export type PaymentMethod = "efectivo" | "transferencia" | "credito" | "CREDITO";
export type CashMovementType = "ingreso" | "retiro" | "venta";

export interface Product {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  activo: boolean;
}

export interface ProductVariant {
  id: number;
  productoId: number;
  sku: string;
  codigoBarras: string | null;
  nombre: string | null;
  categoria: string;
  precioVenta: number;
  costo: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
}

export interface CashRegister {
  id: number;
  fechaApertura: Date;
  fechaCierre: Date | null;
  montoInicial: number;
  efectivoEsperado: number | null;
  efectivoReal: number | null;
  diferencia: number | null;
  estado: "abierta" | "cerrada";
}

export interface CashMovement {
  id: number;
  cajaTurnoId: number;
  tipo: CashMovementType;
  metodoPago: PaymentMethod | null;
  monto: number;
  concepto: string;
  createdAt: Date;
}

export interface SaleLineInput {
  varianteId: number;
  cantidad: number;
}

export interface SaleInput {
  cajaTurnoId: number;
  metodoPago: PaymentMethod;
  lineas: SaleLineInput[];
  clienteCredito?: {
    nombre: string;
    identificacion?: string;
    fechaVencimiento?: string;
  };
}

export interface SaleSummary {
  id: number;
  subtotal: number;
  total: number;
  costoTotal: number;
}
