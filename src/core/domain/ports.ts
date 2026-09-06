import type {
  CashMovement,
  CashMovementType,
  CashRegister,
  PaymentMethod,
  ProductVariant,
  SaleInput,
  SaleSummary,
} from "./entities";

export interface CreateProductInput {
  nombre: string;
  descripcion?: string;
  categoria?: string;
  sku?: string;
  codigoBarras?: string;
  varianteNombre?: string;
  precioVenta: number;
  costo: number;
  stockInicial?: number;
  stockMinimo?: number;
}

export interface ProductRepository {
  create(input: CreateProductInput): Promise<ProductVariant>;
  findById(id: number): Promise<ProductVariant | null>;
  findByCode(code: string): Promise<ProductVariant | null>;
  search(term: string): Promise<ProductVariant[]>;
  getAll(): Promise<ProductVariant[]>;
  listLowStock(): Promise<ProductVariant[]>;
  adjustStock(id: number, delta: number): Promise<ProductVariant>;
}

export interface CashRegisterRepository {
  findOpen(): Promise<CashRegister | null>;
  open(montoInicial: number): Promise<CashRegister>;
  close(id: number, efectivoReal: number): Promise<CashRegister>;
  addMovement(input: {
    cajaTurnoId: number;
    tipo: CashMovementType;
    monto: number;
    concepto: string;
    metodoPago?: Exclude<PaymentMethod, "credito">;
  }): Promise<CashMovement>;
}

export interface SaleRepository {
  register(input: SaleInput): Promise<SaleSummary>;
}

export interface ReceivableAccount {
  id: number;
  clienteNombre: string;
  clienteIdentificacion: string | null;
  referencia: string;
  montoOriginal: number;
  saldo: number;
  fechaVencimiento: string | null;
  estado: "pendiente" | "pagada" | "vencida";
}

export interface CustomerCreditRepository {
  createCredit(input: { clienteNombre: string; clienteIdentificacion?: string; referencia: string; monto: number; fechaVencimiento?: string }): Promise<ReceivableAccount>;
  addPayment(input: { cuentaId: number; monto: number; metodoPago: PaymentMethod }): Promise<ReceivableAccount>;
  findById(id: number): Promise<ReceivableAccount | null>;
  list(): Promise<ReceivableAccount[]>;
}

export interface PayableInvoice {
  id: number;
  proveedorNombre: string;
  numeroFactura: string;
  saldo: number;
  fechaVencimiento: string;
  estado: "pendiente" | "pagada" | "vencida";
}

export interface PayableRepository {
  listDueBefore(days: number): Promise<PayableInvoice[]>;
}
