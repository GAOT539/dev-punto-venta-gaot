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
    metodoPago?: PaymentMethod;
  }): Promise<CashMovement>;
}

export interface SaleRepository {
  register(input: SaleInput): Promise<SaleSummary>;
}
