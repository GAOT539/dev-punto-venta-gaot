"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

type CartItem = {
  id: number;
  sku: string;
  nombre: string | null;
  precioVenta: number;
  cantidad: number;
};

const navItems = ["Resumen", "Punto de venta", "Inventario", "Caja", "Cuentas por cobrar"];

export default function Home() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Listo para escanear");
  const [cart, setCart] = useState<CartItem[]>([]);

  const total = cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    setMessage("Buscando producto...");
    try {
      const response = await fetch(`/api/products?code=${encodeURIComponent(trimmedCode)}`);
      if (!response.ok) throw new Error("Producto no encontrado");
      const product = await response.json();
      setCart((current) => {
        const existing = current.find((item) => item.id === product.id);
        if (existing) {
          return current.map((item) => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item);
        }
        return [...current, { ...product, cantidad: 1 }];
      });
      setCode("");
      setMessage("Producto agregado");
    } catch {
      setMessage("No se encontró el producto o la base de datos no está disponible");
    }
  }

  function changeQuantity(id: number, amount: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== id) return [item];
      const cantidad = item.cantidad + amount;
      return cantidad > 0 ? [{ ...item, cantidad }] : [];
    }));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Image src="/logo.png" alt="Punto de Venta" width={52} height={52} priority />
          <div><strong>GAOT</strong><span>Punto de venta</span></div>
        </div>
        <nav aria-label="Navegación principal">
          {navItems.map((item, index) => <button className={`nav-item ${index === 1 ? "active" : ""}`} key={item}>{item}</button>)}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Sistema operativo</div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><p className="eyebrow">Operación diaria</p><h1>Punto de venta</h1></div><div className="date-chip">Turno sin abrir <span>•</span> Hoy</div></header>

        <div className="dashboard-grid">
          <section className="pos-panel panel">
            <div className="section-heading"><div><p className="eyebrow">Venta rápida</p><h2>Escanear productos</h2></div><span className="kbd">ENTER</span></div>
            <form className="scanner" onSubmit={addProduct}>
              <span className="scan-icon">⌕</span>
              <input autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código de barras o SKU" aria-label="Código de barras o SKU" />
              <button type="submit">Agregar</button>
            </form>
            <p className="helper-text">{message}</p>
            <div className="cart-table-wrap"><table><thead><tr><th>Producto</th><th>SKU</th><th>Cantidad</th><th className="align-right">Subtotal</th></tr></thead><tbody>
              {cart.length === 0 ? <tr><td colSpan={4} className="empty-state">Escanea un producto para iniciar la venta</td></tr> : cart.map((item) => <tr key={item.id}><td><strong>{item.nombre || "Producto"}</strong></td><td className="muted">{item.sku}</td><td><div className="quantity"><button onClick={() => changeQuantity(item.id, -1)} aria-label="Disminuir cantidad">−</button><span>{item.cantidad}</span><button onClick={() => changeQuantity(item.id, 1)} aria-label="Aumentar cantidad">+</button></div></td><td className="align-right price">${(item.precioVenta * item.cantidad).toFixed(2)}</td></tr>)}
            </tbody></table></div>
            <div className="checkout"><div><span>Total a cobrar</span><strong>${total.toFixed(2)}</strong></div><button className="primary-action" disabled={cart.length === 0}>Cobrar venta <span>→</span></button></div>
          </section>

          <aside className="right-column">
            <section className="metric-row"><div className="metric-card"><span>Ventas del día</span><strong>$0.00</strong><small>Sin movimientos</small></div><div className="metric-card accent"><span>Margen estimado</span><strong>0%</strong><small>Precio venta vs costo</small></div></section>
            <section className="panel alerts"><div className="section-heading"><div><p className="eyebrow">Requiere atención</p><h2>Alertas</h2></div><button className="text-button">Ver todo</button></div><div className="alert-item orange"><span>!</span><div><strong>Stock mínimo</strong><p>Conecta la base de datos para consultar alertas</p></div></div><div className="alert-item red"><span>◷</span><div><strong>Facturas por vencer</strong><p>Sin facturas pendientes registradas</p></div></div></section>
            <section className="panel quick-card"><p className="eyebrow">Caja</p><h2>Turno pendiente</h2><p>Abre la caja para comenzar a registrar ventas y movimientos.</p><button className="secondary-action">Abrir caja <span>→</span></button></section>
          </aside>
        </div>
      </section>
    </main>
  );
}
