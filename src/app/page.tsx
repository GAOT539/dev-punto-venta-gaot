"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type Product = { id: number; sku: string; nombre: string | null; precioVenta: number; stockActual: number };
type CartItem = Product & { cantidad: number };
type Cash = { id: number; montoInicial: number; efectivoEsperado: number | null; estado: "abierta" | "cerrada" } | null;
type Modal = "open" | "close" | "movement" | null;

const navItems = ["Resumen", "Punto de venta", "Inventario", "Caja", "Cuentas por cobrar"];

export default function Home() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Listo para escanear o buscar por nombre");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cash, setCash] = useState<Cash>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia" | "credito">("efectivo");
  const [creditCustomer, setCreditCustomer] = useState("");
  const total = cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0);

  useEffect(() => {
    const term = code.trim();
    if (term.length < 2) {
      const timer = setTimeout(() => setSuggestions([]), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/products?code=${encodeURIComponent(term)}`);
        const data = await response.json();
        setSuggestions(data.products ?? (data.id ? [data] : []));
      } catch { setSuggestions([]); }
    }, 180);
    return () => clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    fetch("/api/cash").then((response) => response.json()).then((data) => setCash(data.caja ?? null)).catch(() => undefined);
  }, []);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing ? current.map((item) => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item) : [...current, { ...product, cantidad: 1 }];
    });
    setCode(""); setSuggestions([]); setMessage("Producto agregado");
  }

  async function searchProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = code.trim();
    if (!term) return;
    try {
      const response = await fetch(`/api/products?code=${encodeURIComponent(term)}`);
      const data = await response.json();
      if (data.id) addToCart(data);
      else if (data.products?.length === 1) addToCart(data.products[0]);
      else setMessage(data.products?.length ? "Selecciona un producto de la lista" : "No se encontró el producto");
    } catch { setMessage("La base de datos no está disponible"); }
  }

  function changeQuantity(id: number, amount: number) {
    setCart((current) => current.flatMap((item) => item.id === id && item.cantidad + amount > 0 ? [{ ...item, cantidad: item.cantidad + amount }] : item.id === id ? [] : [item]));
  }

  async function submitCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = modal === "open" ? "open" : modal === "close" ? "close" : "movement";
    const body = action === "open" ? { action, montoInicial: Number(form.get("monto")) } : action === "close" ? { action, id: cash?.id, efectivoReal: Number(form.get("monto")) } : { cajaTurnoId: cash?.id, tipo: form.get("tipo"), monto: Number(form.get("monto")), concepto: form.get("concepto") };
    const response = await fetch("/api/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "No se pudo actualizar la caja"); return; }
    setCash(action === "close" ? null : action === "open" ? data : cash); setModal(null); setMessage("Operación de caja registrada");
  }

  async function chargeSale() {
    if (!cash || cart.length === 0) { setMessage("Abre una caja antes de cobrar una venta"); return; }
    if (paymentMethod === "credito" && !creditCustomer.trim()) { setMessage("Indica el cliente para registrar la venta a crédito"); return; }
    const response = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cajaTurnoId: cash.id, metodoPago: paymentMethod, clienteCredito: paymentMethod === "credito" ? { nombre: creditCustomer.trim() } : undefined, lineas: cart.map((item) => ({ varianteId: item.id, cantidad: item.cantidad })) }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "No se pudo registrar la venta"); return; }
    setCart([]); setCreditCustomer(""); setMessage(`Venta #${data.id} registrada correctamente`);
  }

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><Image src="/logo.png" alt="Punto de Venta" width={52} height={52} priority /><div><strong>GAOT</strong><span>Punto de venta</span></div></div><nav aria-label="Navegación principal">{navItems.map((item, index) => <button className={`nav-item ${index === 1 ? "active" : ""}`} key={item}>{item}</button>)}</nav><div className="sidebar-footer"><span className="status-dot" /> Sistema operativo</div></aside>
    <section className="workspace"><header className="topbar"><div><p className="eyebrow">Operación diaria</p><h1>Punto de venta</h1></div><div className="date-chip">{cash ? "Turno abierto" : "Sin turno"}<span>•</span> Hoy</div></header>
      <div className="dashboard-grid"><section className="pos-panel panel"><div className="section-heading"><div><p className="eyebrow">Venta rápida</p><h2>Escanear productos</h2></div><span className="kbd">ENTER</span></div><form className="scanner search-box" onSubmit={searchProduct}><span className="scan-icon">⌕</span><input autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código, SKU o nombre del producto" aria-label="Buscar producto" /><button type="submit">Agregar</button>{suggestions.length > 0 && <div className="suggestions" role="listbox">{suggestions.map((product) => <button type="button" role="option" aria-selected="false" key={product.id} onClick={() => addToCart(product)}><span><strong>{product.nombre || "Producto"}</strong><small>{product.sku}</small></span><b>${product.precioVenta.toFixed(2)}</b></button>)}</div>}</form><p className="helper-text">{message}</p><div className="cart-table-wrap"><table><thead><tr><th>Producto</th><th>SKU</th><th>Cantidad</th><th className="align-right">Subtotal</th></tr></thead><tbody>{cart.length === 0 ? <tr><td colSpan={4} className="empty-state">Escanea o busca un producto para iniciar la venta</td></tr> : cart.map((item) => <tr key={item.id}><td><strong>{item.nombre || "Producto"}</strong></td><td className="muted">{item.sku}</td><td><div className="quantity"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Disminuir cantidad">−</button><span>{item.cantidad}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Aumentar cantidad">+</button></div></td><td className="align-right price">${(item.precioVenta * item.cantidad).toFixed(2)}</td></tr>)}</tbody></table></div><div className="checkout"><div><span>Total a cobrar</span><strong>${total.toFixed(2)}</strong></div><div className="checkout-controls"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} aria-label="Método de pago"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="credito">Crédito</option></select>{paymentMethod === "credito" && <input value={creditCustomer} onChange={(event) => setCreditCustomer(event.target.value)} placeholder="Cliente" aria-label="Cliente de crédito" />}<button type="button" className="primary-action" disabled={cart.length === 0} onClick={chargeSale}>Cobrar venta <span>→</span></button></div></div></section>
        <aside className="right-column"><section className="metric-row"><div className="metric-card"><span>Ventas del día</span><strong>$0.00</strong><small>Sin movimientos</small></div><div className="metric-card accent"><span>Margen estimado</span><strong>0%</strong><small>Precio venta vs costo</small></div></section><section className="panel alerts"><div className="section-heading"><div><p className="eyebrow">Requiere atención</p><h2>Alertas</h2></div><button className="text-button">Ver todo</button></div><div className="alert-item orange"><span>!</span><div><strong>Stock mínimo</strong><p>Consulta el inventario bajo desde el módulo de alertas</p></div></div><div className="alert-item red"><span>◷</span><div><strong>Facturas por vencer</strong><p>Revisa las cuentas pendientes de proveedores</p></div></div></section><section className="panel cash-actions"><div className="section-heading"><div><p className="eyebrow">Caja</p><h2>{cash ? "Turno abierto" : "Caja disponible"}</h2></div><span className={`cash-state ${cash ? "open" : ""}`}>{cash ? "Activa" : "Lista"}</span></div><p>{cash ? `Efectivo inicial $${cash.montoInicial.toFixed(2)}` : "Puedes cobrar y administrar inventario sin bloquear la pantalla."}</p><div className="action-grid"><button className="secondary-action" onClick={() => setModal("open")}>Abrir caja</button><button className="secondary-action" onClick={() => setModal("movement")}>Movimiento</button>{cash && <button className="secondary-action wide" onClick={() => setModal("close")}>Cerrar y cuadrar caja</button>}</div></section></aside></div></section>
    {modal && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setModal(null)} aria-label="Cerrar">×</button><p className="eyebrow">Caja</p><h2 id="modal-title">{modal === "open" ? "Apertura de caja" : modal === "close" ? "Cierre y cuadre" : "Movimiento manual"}</h2><p className="modal-copy">{modal === "open" ? "Registra el efectivo disponible al iniciar el turno." : modal === "close" ? "Indica el efectivo contado para calcular la diferencia." : "Registra un ingreso o retiro con su concepto."}</p><form onSubmit={submitCash}>{modal === "movement" && <><label>Tipo<select name="tipo" defaultValue="ingreso"><option value="ingreso">Ingreso</option><option value="retiro">Retiro</option></select></label><label>Concepto<input name="concepto" required placeholder="Ej. pago de servicio" /></label></>}<label>{modal === "close" ? "Efectivo contado" : "Monto"}<input name="monto" type="number" min="0" step="0.01" required autoFocus /></label><button className="primary-action modal-submit" type="submit">Guardar operación</button></form></section></div>}
  </main>;
}
