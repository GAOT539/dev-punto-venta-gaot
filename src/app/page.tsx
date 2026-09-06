"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type Product = { id: number; sku: string; nombre: string | null; precioVenta: number; stockActual: number; stockMinimo: number };
type CartItem = Product & { cantidad: number };
type Cash = { id: number; montoInicial: number; efectivoEsperado: number | null; estado: "abierta" | "cerrada" } | null;
type Modal = "open" | "close" | "movement" | null;
type Account = { id: number; cliente_nombre: string; referencia: string; monto_original: number; saldo: number; estado: string; fecha_vencimiento: string | null };

const navItems = ["Resumen", "Punto de venta", "Inventario", "Caja", "Cuentas por cobrar"];

export default function Home() {
  const [activeTab, setActiveTab] = useState("Punto de venta");
  
  // POS States
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Listo para escanear o buscar por nombre");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia" | "credito">("efectivo");
  const [creditCustomer, setCreditCustomer] = useState("");
  const total = cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0);

  // Cash States
  const [cash, setCash] = useState<Cash>(null);
  const [modal, setModal] = useState<Modal>(null);

  // Inventory States
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryResults, setInventoryResults] = useState<Product[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<Product[]>([]);

  // Receivables States
  const [receivables, setReceivables] = useState<Account[]>([]);
  const [paymentModalData, setPaymentModalData] = useState<Account | null>(null);

  // Initial Fetch for Cash & Alerts
  useEffect(() => {
    fetch("/api/cash").then((response) => response.json()).then((data) => setCash(data.caja ?? null)).catch(() => undefined);
    fetch("/api/inventory/alerts").then(res => res.json()).then(data => setInventoryAlerts(data.products || [])).catch(() => undefined);
  }, []);

  // Fetch based on Active Tab
  useEffect(() => {
    if (activeTab === "Inventario") {
      fetch("/api/inventory/alerts").then(res => res.json()).then(data => setInventoryAlerts(data.products || [])).catch(() => undefined);
    }
    if (activeTab === "Cuentas por cobrar") {
      fetchReceivablesData();
    }
  }, [activeTab]);

  async function fetchReceivablesData() {
    try {
      const res = await fetch("/api/receivables");
      const data = await res.json();
      setReceivables(data.accounts || []);
    } catch {}
  }

  // --- POS Functions ---
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

  async function chargeSale() {
    if (!cash || cart.length === 0) { setMessage("Abre una caja antes de cobrar una venta"); return; }
    if (paymentMethod === "credito" && !creditCustomer.trim()) { setMessage("Indica el cliente para registrar la venta a crédito"); return; }
    const response = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cajaTurnoId: cash.id, metodoPago: paymentMethod, clienteCredito: paymentMethod === "credito" ? { nombre: creditCustomer.trim() } : undefined, lineas: cart.map((item) => ({ varianteId: item.id, cantidad: item.cantidad })) }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "No se pudo registrar la venta"); return; }
    setCart([]); setCreditCustomer(""); setMessage(`Venta #${data.id} registrada correctamente`);
  }

  // --- Cash Functions ---
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

  // --- Inventory Functions ---
  async function performInventorySearch(e: FormEvent) {
    e.preventDefault();
    if(!inventorySearch.trim()) return;
    try {
      const response = await fetch(`/api/products?code=${encodeURIComponent(inventorySearch)}`);
      const data = await response.json();
      setInventoryResults(data.products ?? (data.id ? [data] : []));
    } catch {}
  }

  // --- Receivables Functions ---
  async function submitPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const monto = Number(form.get("monto"));
    const metodoPago = form.get("metodoPago") as string;
    const res = await fetch("/api/receivables", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ action: "payment", cuentaId: paymentModalData?.id, monto, metodoPago })
    });
    if(res.ok) {
       setPaymentModalData(null);
       fetchReceivablesData();
    }
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><Image src="/logo.png" alt="Punto de Venta" width={52} height={52} priority /><div><strong>GAOT</strong><span>Punto de venta</span></div></div>
      <nav aria-label="Navegación principal">
        {navItems.map((item) => <button type="button" className={`nav-item ${activeTab === item ? "active" : ""}`} key={item} onClick={() => setActiveTab(item)}>{item}</button>)}
      </nav>
      <div className="sidebar-footer"><span className="status-dot" /> Sistema operativo</div>
    </aside>
    
    <section className="workspace">
      <header className="topbar">
        <div><p className="eyebrow">Operación diaria</p><h1>{activeTab}</h1></div>
        <div className="date-chip">{cash ? "Turno abierto" : "Sin turno"}<span>•</span> Hoy</div>
      </header>

      {/* VISTA RESUMEN */}
      {activeTab === "Resumen" && (
        <div className="dashboard-grid">
           <section className="panel" style={{gridColumn: "1 / -1"}}>
             <div className="section-heading"><div><p className="eyebrow">Bienvenida</p><h2>Resumen del Sistema</h2></div></div>
             <p className="muted" style={{lineHeight: 1.6, fontSize: "14px"}}>
               El sistema Punto de Venta se encuentra operativo y conectado a la base de datos local.
               <br/><br/>
               Utiliza el menú lateral para acceder a las funcionalidades de Inventario, control de Caja y Cuentas por cobrar. Puedes mantener ventanas inactivas y regresar al Punto de Venta sin perder la información del carrito de compras, garantizando una operación fluida y sin bloqueos.
             </p>
           </section>
        </div>
      )}

      {/* VISTA PUNTO DE VENTA */}
      {activeTab === "Punto de venta" && (
        <div className="dashboard-grid">
          <section className="pos-panel panel">
            <div className="section-heading"><div><p className="eyebrow">Venta rápida</p><h2>Escanear productos</h2></div><span className="kbd">ENTER</span></div>
            <form className="scanner search-box" onSubmit={searchProduct}>
              <span className="scan-icon">⌕</span>
              <input autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código, SKU o nombre del producto" aria-label="Buscar producto" />
              <button type="submit">Agregar</button>
              {suggestions.length > 0 && <div className="suggestions" role="listbox">{suggestions.map((product) => <button type="button" role="option" aria-selected="false" key={product.id} onClick={() => addToCart(product)}><span><strong>{product.nombre || "Producto"}</strong><small>{product.sku}</small></span><b>${product.precioVenta.toFixed(2)}</b></button>)}</div>}
            </form>
            <p className="helper-text">{message}</p>
            <div className="cart-table-wrap">
              <table>
                <thead><tr><th>Producto</th><th>SKU</th><th>Cantidad</th><th className="align-right">Subtotal</th></tr></thead>
                <tbody>
                  {cart.length === 0 ? <tr><td colSpan={4} className="empty-state">Escanea o busca un producto para iniciar la venta</td></tr> : cart.map((item) => <tr key={item.id}><td><strong>{item.nombre || "Producto"}</strong></td><td className="muted">{item.sku}</td><td><div className="quantity"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Disminuir cantidad">−</button><span>{item.cantidad}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Aumentar cantidad">+</button></div></td><td className="align-right price">${(item.precioVenta * item.cantidad).toFixed(2)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="checkout">
              <div><span>Total a cobrar</span><strong>${total.toFixed(2)}</strong></div>
              <div className="checkout-controls">
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} aria-label="Método de pago"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="credito">Crédito</option></select>
                {paymentMethod === "credito" && <input value={creditCustomer} onChange={(event) => setCreditCustomer(event.target.value)} placeholder="Cliente" aria-label="Cliente de crédito" />}
                <button type="button" className="primary-action" disabled={cart.length === 0} onClick={chargeSale}>Cobrar venta <span>→</span></button>
              </div>
            </div>
          </section>
          
          <aside className="right-column">
            <section className="metric-row">
              <div className="metric-card"><span>Ventas del día</span><strong>$0.00</strong><small>Sin movimientos</small></div>
              <div className="metric-card accent"><span>Margen estimado</span><strong>0%</strong><small>Precio venta vs costo</small></div>
            </section>
            
            <section className="panel alerts">
              <div className="section-heading"><div><p className="eyebrow">Requiere atención</p><h2>Alertas</h2></div><button type="button" className="text-button" onClick={() => setActiveTab("Inventario")}>Ver inventario</button></div>
              {inventoryAlerts.length > 0 ? (
                <div className="alert-item orange"><span>!</span><div><strong>Stock mínimo</strong><p>Hay {inventoryAlerts.length} producto(s) por debajo del mínimo</p></div></div>
              ) : (
                <p className="muted" style={{fontSize: "12px", marginTop: "10px"}}>Sin alertas de stock actuales.</p>
              )}
            </section>
            
            <section className="panel cash-actions">
              <div className="section-heading"><div><p className="eyebrow">Caja</p><h2>{cash ? "Turno abierto" : "Caja disponible"}</h2></div><span className={`cash-state ${cash ? "open" : ""}`}>{cash ? "Activa" : "Lista"}</span></div>
              <p>{cash ? `Efectivo inicial $${cash.montoInicial.toFixed(2)}` : "Puedes cobrar y administrar inventario sin bloquear la pantalla."}</p>
              <div className="action-grid">
                <button type="button" className="secondary-action" onClick={() => setModal("open")}>Abrir caja</button>
                <button type="button" className="secondary-action" onClick={() => setModal("movement")}>Movimiento</button>
                {cash && <button type="button" className="secondary-action wide" onClick={() => setModal("close")}>Cerrar y cuadrar caja</button>}
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* VISTA INVENTARIO */}
      {activeTab === "Inventario" && (
        <div className="dashboard-grid">
          <section className="panel">
            <div className="section-heading"><div><p className="eyebrow">Catálogo</p><h2>Búsqueda de Inventario</h2></div></div>
            <form className="scanner search-box" onSubmit={performInventorySearch}>
              <span className="scan-icon">⌕</span>
              <input value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} placeholder="Buscar por SKU, código de barras o nombre" />
              <button type="submit">Buscar</button>
            </form>
            <div className="cart-table-wrap" style={{marginTop: "20px"}}>
              <table>
                <thead><tr><th>Producto</th><th>SKU</th><th>Stock Actual</th><th className="align-right">Precio Venta</th></tr></thead>
                <tbody>
                  {inventoryResults.length === 0 ? <tr><td colSpan={4} className="empty-state">Busca un producto para visualizar su estado</td></tr> : inventoryResults.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.nombre || "Producto"}</strong></td>
                      <td className="muted">{p.sku}</td>
                      <td><span className={p.stockActual <= p.stockMinimo ? "muted" : ""} style={{fontWeight: 700, color: p.stockActual <= p.stockMinimo ? "var(--red)" : "inherit"}}>{p.stockActual}</span></td>
                      <td className="align-right price">${p.precioVenta.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="right-column">
             <section className="panel alerts">
                <div className="section-heading"><div><p className="eyebrow">Crítico</p><h2>Alertas de Stock</h2></div></div>
                {inventoryAlerts.length === 0 ? <p className="muted" style={{fontSize: "12px", marginTop: "10px"}}>No hay productos bajo stock mínimo.</p> : inventoryAlerts.map(p => (
                  <div key={p.id} className="alert-item orange">
                    <span>!</span>
                    <div>
                      <strong>{p.nombre}</strong>
                      <p>Stock actual: {p.stockActual} (Mín: {p.stockMinimo})</p>
                    </div>
                  </div>
                ))}
             </section>
          </aside>
        </div>
      )}

      {/* VISTA CAJA */}
      {activeTab === "Caja" && (
         <div className="dashboard-grid">
            <section className="panel cash-actions" style={{minHeight: "400px"}}>
              <div className="section-heading"><div><p className="eyebrow">Gestión</p><h2>Panel de Caja</h2></div><span className={`cash-state ${cash ? "open" : ""}`}>{cash ? "Activa" : "Cerrada"}</span></div>
              <div style={{marginBottom: "30px"}}>
                 <p style={{marginBottom: "15px", fontSize: "14px"}}>
                   Estado actual: <strong>{cash ? "Turno de caja abierto" : "Turno cerrado"}</strong>
                 </p>
                 {cash && <p style={{marginBottom: "10px", color: "var(--ink)", fontWeight: "500", fontSize: "14px"}}>Monto Inicial: <span style={{fontWeight: 700}}>${cash.montoInicial.toFixed(2)}</span></p>}
              </div>
              <div className="action-grid" style={{display: "flex", gap: "12px"}}>
                {!cash && <button type="button" className="primary-action" onClick={() => setModal("open")}>Abrir nueva caja</button>}
                {cash && <button type="button" className="secondary-action" style={{marginTop: 0, padding: "14px 20px"}} onClick={() => setModal("movement")}>Registrar Movimiento</button>}
                {cash && <button type="button" className="primary-action" style={{background: "var(--red)"}} onClick={() => setModal("close")}>Cerrar y cuadrar caja</button>}
              </div>
            </section>
         </div>
      )}

      {/* VISTA CUENTAS POR COBRAR */}
      {activeTab === "Cuentas por cobrar" && (
         <div className="dashboard-grid">
            <section className="panel" style={{gridColumn: "1 / -1"}}>
              <div className="section-heading"><div><p className="eyebrow">CRM</p><h2>Cuentas por cobrar</h2></div></div>
              <div className="cart-table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Referencia</th><th>Estado</th><th className="align-right">Saldo Deudor</th><th className="align-right">Acciones</th></tr></thead>
                  <tbody>
                    {receivables.length === 0 ? <tr><td colSpan={5} className="empty-state">No hay cuentas por cobrar registradas</td></tr> : receivables.map(acc => (
                      <tr key={acc.id}>
                        <td><strong>{acc.cliente_nombre}</strong></td>
                        <td className="muted">{acc.referencia}</td>
                        <td>
                           <span className="cash-state" style={{background: acc.estado === "pendiente" ? "#fff0d5" : acc.estado === "pagada" ? "#e8f4bb" : "#fce5e1", color: acc.estado === "pendiente" ? "#a16a14" : acc.estado === "pagada" ? "#687332" : "#b04f47"}}>{acc.estado.toUpperCase()}</span>
                        </td>
                        <td className="align-right price">${Number(acc.saldo).toFixed(2)}</td>
                        <td className="align-right">
                           {acc.estado !== "pagada" ? (
                              <button type="button" className="primary-action" style={{padding: "8px 12px"}} onClick={() => setPaymentModalData(acc)}>Abonar</button>
                           ) : (
                              <span className="muted">Pagada</span>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
         </div>
      )}
    </section>
    
    {/* MODAL CAJA */}
    {modal && (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Cerrar">×</button>
          <p className="eyebrow">Caja</p>
          <h2 id="modal-title">{modal === "open" ? "Apertura de caja" : modal === "close" ? "Cierre y cuadre" : "Movimiento manual"}</h2>
          <p className="modal-copy">{modal === "open" ? "Registra el efectivo disponible al iniciar el turno." : modal === "close" ? "Indica el efectivo contado para calcular la diferencia." : "Registra un ingreso o retiro con su concepto."}</p>
          <form onSubmit={submitCash}>
            {modal === "movement" && (
              <>
                <label>Tipo<select name="tipo" defaultValue="ingreso"><option value="ingreso">Ingreso</option><option value="retiro">Retiro</option></select></label>
                <label>Concepto<input name="concepto" required placeholder="Ej. pago de servicio" /></label>
              </>
            )}
            <label>{modal === "close" ? "Efectivo contado" : "Monto"}<input name="monto" type="number" min="0" step="0.01" required autoFocus /></label>
            <button className="primary-action modal-submit" type="submit">Guardar operación</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL ABONO CUENTAS POR COBRAR */}
    {paymentModalData && (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button type="button" className="modal-close" onClick={() => setPaymentModalData(null)} aria-label="Cerrar">×</button>
          <p className="eyebrow">CRM - Abono</p>
          <h2 id="modal-title">Abonar a {paymentModalData.cliente_nombre}</h2>
          <p className="modal-copy" style={{marginBottom: "20px"}}>Saldo actual: <strong style={{fontSize: "16px"}}>${Number(paymentModalData.saldo).toFixed(2)}</strong></p>
          <form onSubmit={submitPayment}>
             <label>Método de pago
               <select name="metodoPago" defaultValue="efectivo">
                 <option value="efectivo">Efectivo</option>
                 <option value="transferencia">Transferencia</option>
               </select>
             </label>
             <label>Monto a abonar
               <input name="monto" type="number" min="0.01" max={Number(paymentModalData.saldo)} step="0.01" required autoFocus />
             </label>
             <button className="primary-action modal-submit" type="submit">Registrar Abono</button>
          </form>
        </section>
      </div>
    )}
  </main>;
}
