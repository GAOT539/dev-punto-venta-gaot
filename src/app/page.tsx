"use client";

import Image from "next/image";
import React, { FormEvent, useEffect, useState, useMemo } from "react";

type Product = { id: number; sku: string; nombre: string | null; categoria: string; precioVenta: number; stockActual: number; stockMinimo: number };
type CartItem = Product & { cantidad: number };
type Cash = { id: number; montoInicial: number; efectivoEsperado: number | null; estado: "abierta" | "cerrada" } | null;
type Modal = "open" | "close" | "movement" | null;
type Account = { id: number; cliente_nombre: string; referencia: string; monto_original: number; saldo: number; estado: string; fecha_vencimiento: string | null, created_at?: string };
type SaleRec = { id: number, created_at: string, metodo_pago: string, total: string | number };
type MovRec = { id: number, created_at: string, concepto: string, tipo: string, monto: string | number };
type UnifiedOp = { id: number; realId: number; isSale: boolean; hora: string; dateObj: Date; metodo: string; tipo: string; total: number; concepto?: string };

const navItems = ["Resumen", "Punto de venta", "Historial / Caja", "Inventario", "Cuentas por cobrar"];

export default function Home() {
  const [activeTab, setActiveTab] = useState("Resumen");
  const [toast, setToast] = useState("");
  
  // Dashboard
  const [dashboard, setDashboard] = useState<{ ventasTotalesMes?: number; valorInventario?: number; rankingMejoresDias?: {fecha: string; total: number; cantidad: number;}[] } | null>(null);

  // POS States
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Listo para escanear o buscar por nombre");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia" | "CREDITO">("efectivo");
  const [creditCustomer, setCreditCustomer] = useState("");
  const total = cart.reduce((sum, item) => sum + item.precioVenta * item.cantidad, 0);

  // Cash / History States
  const [cash, setCash] = useState<Cash>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [salesDate, setSalesDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesData, setSalesData] = useState<{ventas: SaleRec[], movimientos: MovRec[]}>({ventas: [], movimientos: []});
  const [expandedOp, setExpandedOp] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<any[]>([]);

  // Inventory States
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryResults, setInventoryResults] = useState<Product[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<Product[]>([]);
  const [invCategoryFilter, setInvCategoryFilter] = useState("Todas");

  // Receivables States
  const [receivables, setReceivables] = useState<Account[]>([]);
  const [paymentModalData, setPaymentModalData] = useState<Account | null>(null);
  const [receivableTab, setReceivableTab] = useState<"hoy" | "todas">("todas");

  // Initial Fetch for Cash & Alerts
  useEffect(() => {
    fetch("/api/cash").then((response) => response.json()).then((data) => setCash(data.caja ?? null)).catch(() => undefined);
    fetch("/api/inventory/alerts").then(res => res.json()).then(data => setInventoryAlerts(data.products || [])).catch(() => undefined);
  }, []);

  // Fetch based on Active Tab
  useEffect(() => {
    if (activeTab === "Resumen") {
      fetch("/api/dashboard").then(res => res.json()).then(setDashboard).catch(() => undefined);
    }
    if (activeTab === "Inventario") {
      fetch("/api/products").then(res => res.json()).then(data => setInventoryResults(data.products || [])).catch(() => undefined);
    }
    if (activeTab === "Cuentas por cobrar") {
      fetchReceivablesData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "Historial / Caja") {
       fetch(`/api/sales?date=${salesDate}`).then(res => res.json()).then(data => {
          if (!data.error) setSalesData(data);
       }).catch(() => undefined);
    }
  }, [activeTab, salesDate, cash]);

  async function fetchReceivablesData() {
    try {
      const res = await fetch("/api/receivables");
      const data = await res.json();
      setReceivables(data.accounts || []);
    } catch {}
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
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
    if (!cash || cart.length === 0) return;
    if (paymentMethod === "CREDITO" && !creditCustomer.trim()) { setMessage("Indica el cliente para registrar la venta a crédito"); return; }
    const response = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cajaTurnoId: cash.id, metodoPago: paymentMethod, clienteCredito: paymentMethod === "CREDITO" ? { nombre: creditCustomer.trim() } : undefined, lineas: cart.map((item) => ({ varianteId: item.id, cantidad: item.cantidad })) }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "No se pudo registrar la venta"); return; }
    
    // POS Feedback y limpieza automática
    setCart([]); setCreditCustomer(""); 
    showToast("¡Cobrado con éxito!");
    setMessage(`Venta #${data.id} registrada correctamente`);
    
    // Refrescar caja para reflejar los ingresos
    fetch("/api/cash").then(r => r.json()).then(d => setCash(d.caja ?? null));
  }

  // --- Cash Functions ---
  async function submitCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = modal === "open" ? "open" : modal === "close" ? "close" : "movement";
    const body = action === "open" ? { action, montoInicial: Number(form.get("monto")) } : action === "close" ? { action, id: cash?.id, efectivoReal: Number(form.get("monto")) } : { cajaTurnoId: cash?.id, tipo: form.get("tipo"), monto: Number(form.get("monto")), concepto: form.get("concepto") };
    const response = await fetch("/api/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { showToast(data.error ?? "Error en caja"); return; }
    setCash(action === "close" ? null : action === "open" ? data : cash); setModal(null); showToast("Operación de caja registrada");
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
       body: JSON.stringify({ action: "payment", cuentaId: paymentModalData?.id, monto, metodoPago, cajaTurnoId: cash?.id })
    });
    if(res.ok) {
       setPaymentModalData(null);
       fetchReceivablesData();
       showToast("Abono registrado correctamente");
       fetch("/api/cash").then(r => r.json()).then(d => setCash(d.caja ?? null));
    } else {
       const err = await res.json();
       showToast(err.error || "Error al registrar abono");
    }
  }

  async function markAsPaid(acc: Account) {
    if(!cash) { showToast("Debe aperturar la caja del día para recibir pagos"); return; }
    const res = await fetch("/api/receivables", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "payment", cuentaId: acc.id, monto: acc.saldo, metodoPago: "efectivo", cajaTurnoId: cash.id })
    });
    if(res.ok) {
      fetchReceivablesData(); showToast("Cobrado exitosamente");
      fetch("/api/cash").then(r => r.json()).then(d => setCash(d.caja ?? null));
    } else {
      const err = await res.json();
      showToast(err.error || "Error al registrar abono");
    }
 }

  // --- Computed Values ---
  const filteredInventory = useMemo(() => {
    let list = inventoryResults;
    if (invCategoryFilter !== "Todas") {
      list = list.filter(p => p.categoria === invCategoryFilter);
    }
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase();
      list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return list;
  }, [inventoryResults, invCategoryFilter, inventorySearch]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(inventoryResults.map(p => p.categoria).filter(Boolean));
    return ["Todas", ...Array.from(cats)];
  }, [inventoryResults]);

  const todayStr = new Date().toISOString().split('T')[0];
  const filteredReceivables = useMemo(() => {
    if (receivableTab === "todas") return receivables;
    return receivables.filter(r => r.created_at?.startsWith(todayStr));
  }, [receivables, receivableTab, todayStr]);

  // Cálculos de caja
  const totalIngresos = salesData.ventas.filter(v => v.metodo_pago.toLowerCase() !== 'credito').reduce((sum, v) => sum + Number(v.total), 0) + 
                        salesData.movimientos.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto), 0);
  const totalEgresos = salesData.movimientos.filter(m => m.tipo === 'retiro').reduce((sum, m) => sum + Number(m.monto), 0);

  // Unificación de Operaciones
  const unifiedOperations = useMemo(() => {
    const ops: UnifiedOp[] = [];
    salesData.ventas.forEach(v => {
       const d = new Date(v.created_at);
       ops.push({ id: Math.random(), realId: v.id, isSale: true, hora: d.toLocaleTimeString(), dateObj: d, metodo: v.metodo_pago, tipo: "Venta", total: Number(v.total) });
    });
    salesData.movimientos.forEach(m => {
       const d = new Date(m.created_at);
       ops.push({ id: Math.random(), realId: m.id, isSale: false, hora: d.toLocaleTimeString(), dateObj: d, metodo: 'N/A', tipo: m.tipo, total: Number(m.monto), concepto: m.concepto });
    });
    return ops.sort((a,b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [salesData]);

  async function toggleExpand(op: UnifiedOp) {
    if (expandedOp === op.id) { setExpandedOp(null); return; }
    setExpandedOp(op.id);
    if (op.isSale) {
       setExpandedDetails([]); // clear
       try {
         const res = await fetch(`/api/sales/${op.realId}`);
         const data = await res.json();
         setExpandedDetails(data.detalles || []);
       } catch {}
    }
 }

  return <main className="app-shell">
    {toast && (
      <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white px-6 py-3 rounded shadow-xl transition-all font-semibold">
        {toast}
      </div>
    )}

    <aside className="sidebar">
      <div className="brand"><Image src="/logo.png" alt="Punto de Venta" width={52} height={52} priority /><div><strong>GAOT</strong><span>Punto de venta</span></div></div>
      <nav aria-label="Navegación principal">
        {navItems.map((item) => <button type="button" className={`nav-item ${activeTab === item ? "active" : ""}`} key={item} onClick={() => setActiveTab(item)}>{item}</button>)}
      </nav>
      <div className="sidebar-footer"><span className="status-dot" /> Sistema operativo</div>
    </aside>
    
    <section className="workspace relative">
      <header className="topbar">
        <div><p className="eyebrow">Operación diaria</p><h1>{activeTab}</h1></div>
        <div className="date-chip">{cash ? "Caja abierta" : "Sin turno"}<span>•</span> {new Date().toLocaleDateString()}</div>
      </header>

      {/* VISTA RESUMEN (DASHBOARD) */}
      {activeTab === "Resumen" && (
        <div className="flex flex-col gap-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow">Ventas del Mes</p>
               <h2 className="text-3xl font-bold">${dashboard?.ventasTotalesMes?.toFixed(2) || "0.00"}</h2>
               <p className="text-xs text-gray-500">Total acumulado 30 días</p>
             </div>
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow">Valor de Inventario</p>
               <h2 className="text-3xl font-bold">${dashboard?.valorInventario?.toFixed(2) || "0.00"}</h2>
               <p className="text-xs text-gray-500">Capital en stock valorizado al costo</p>
             </div>
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow">Alertas de Stock</p>
               <h2 className="text-3xl font-bold text-red-500">{inventoryAlerts.length}</h2>
               <p className="text-xs text-gray-500">Productos por debajo del mínimo</p>
             </div>
           </div>

           <section className="panel">
             <div className="section-heading"><div><p className="eyebrow">Desempeño</p><h2>Ranking Mejores Días</h2></div></div>
             <div className="cart-table-wrap mt-4">
               <table>
                 <thead><tr><th>Fecha</th><th className="align-right">Cant. Operaciones</th><th className="align-right">Volumen de Ventas</th></tr></thead>
                 <tbody>
                   {!dashboard?.rankingMejoresDias?.length ? (
                      <tr><td colSpan={3} className="empty-state">Sin historial de ventas para mostrar.</td></tr>
                   ) : dashboard.rankingMejoresDias.map((d, idx: number) => (
                      <tr key={idx}>
                        <td><strong>{new Date(d.fecha).toLocaleDateString()}</strong></td>
                        <td className="align-right muted">{d.cantidad}</td>
                        <td className="align-right price">${d.total.toFixed(2)}</td>
                      </tr>
                   ))}
                 </tbody>
               </table>
             </div>
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
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} aria-label="Método de pago"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="CREDITO">Crédito</option></select>
                {paymentMethod === "CREDITO" && <input value={creditCustomer} onChange={(event) => setCreditCustomer(event.target.value)} placeholder="Cliente" aria-label="Cliente de crédito" />}
                
                <div className="flex flex-col items-end">
                   <button type="button" className="primary-action" disabled={!cash || cart.length === 0} onClick={chargeSale}>Cobrar venta <span>→</span></button>
                   {!cash && <p className="text-red-500 text-xs mt-2 font-bold absolute bottom-2">Debe abrir la caja para poder registrar ventas</p>}
                </div>
              </div>
            </div>
          </section>
          
          <aside className="right-column">
            <section className="metric-row">
              <div className="metric-card"><span>Ventas del día</span><strong>${(dashboard?.rankingMejoresDias?.[0]?.fecha.startsWith(todayStr) ? dashboard.rankingMejoresDias[0].total : 0).toFixed(2)}</strong><small>Acumulado hoy</small></div>
              <div className="metric-card accent"><span>Artículos</span><strong>{cart.reduce((s, i) => s + i.cantidad, 0)}</strong><small>En el carrito</small></div>
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
              <div className="section-heading"><div><p className="eyebrow">Caja</p><h2>{cash ? "Caja abierta" : "Caja disponible"}</h2></div><span className={`cash-state ${cash ? "open" : ""}`}>{cash ? "Activa" : "Lista"}</span></div>
              <p>{cash ? `Efectivo inicial $${cash.montoInicial.toFixed(2)}` : "Puedes cobrar y administrar inventario sin bloquear la pantalla."}</p>
              <div className="action-grid">
                {!cash && <button type="button" className="primary-action" onClick={() => setModal("open")}>Abrir caja</button>}
                {cash && <button type="button" className="secondary-action" onClick={() => setModal("movement")}>Movimiento</button>}
                {cash && <button type="button" className="primary-action wide bg-red-600 hover:bg-red-700" onClick={() => setModal("close")}>Cerrar caja</button>}
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* VISTA HISTORIAL Y CAJA (TABLA UNIFICADA) */}
      {activeTab === "Historial / Caja" && (
         <div className="flex flex-col md:flex-row gap-6">
            <section className="panel flex-1">
              <div className="section-heading">
                <div><p className="eyebrow">Reportes</p><h2>Historial de Ventas</h2></div>
                <input type="date" value={salesDate} onChange={e => setSalesDate(e.target.value)} className="border p-2 rounded text-sm outline-none focus:border-black" />
              </div>
              <div className="cart-table-wrap">
                <table>
                  <thead><tr><th>Ticket ID</th><th>Hora</th><th>Método</th><th>Tipo</th><th className="align-right">Total</th></tr></thead>
                  <tbody>
                    {unifiedOperations.length === 0 ? <tr><td colSpan={5} className="empty-state">No hay operaciones registradas en esta fecha.</td></tr> : unifiedOperations.map(op => (
                      <React.Fragment key={op.id}>
                         <tr onClick={() => toggleExpand(op)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                           <td><strong>{op.isSale ? `#${op.realId}` : '-'}</strong></td>
                           <td className="muted">{op.hora}</td>
                           <td className="capitalize">{op.metodo}</td>
                           <td className="capitalize">{op.tipo}</td>
                           <td className="align-right price">${op.total.toFixed(2)}</td>
                         </tr>
                         {expandedOp === op.id && (
                            <tr className="bg-gray-50 border-b"><td colSpan={5} className="p-4">
                               {op.isSale ? (
                                  expandedDetails.length ? (
                                    <div className="bg-white rounded border overflow-hidden">
                                       <table className="w-full text-sm">
                                         <thead className="bg-gray-100"><tr><th className="p-2 text-left text-xs font-semibold">Producto</th><th className="p-2 text-center text-xs font-semibold">Cant.</th><th className="p-2 text-right text-xs font-semibold">Subtotal</th></tr></thead>
                                         <tbody>
                                           {expandedDetails.map(d => (
                                             <tr key={d.id} className="border-t"><td className="p-2">{d.producto_nombre}</td><td className="p-2 text-center font-medium">{d.cantidad}</td><td className="p-2 text-right">${Number(d.subtotal).toFixed(2)}</td></tr>
                                           ))}
                                         </tbody>
                                       </table>
                                    </div>
                                  ) : <span className="text-xs text-gray-500 font-medium">Cargando detalles...</span>
                               ) : (
                                  <div className="text-sm bg-white p-3 rounded border"><strong>Concepto del Movimiento:</strong> {op.concepto}</div>
                               )}
                            </td></tr>
                         )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            
            <aside className="w-full md:w-80 flex flex-col gap-6">
              <section className="panel">
                <div className="section-heading"><div><p className="eyebrow">Cálculo Automático</p><h2>Resumen del Día</h2></div></div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Ingresos Totales</span>
                  <strong className="text-green-600 font-bold">${totalIngresos.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Egresos</span>
                  <strong className="text-red-500 font-bold">${totalEgresos.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center pt-4 mt-2">
                  <span className="text-sm text-gray-900 font-semibold">Flujo de Caja Neto</span>
                  <strong className="text-2xl">${(totalIngresos - totalEgresos).toFixed(2)}</strong>
                </div>
              </section>

              <section className="panel cash-actions">
                <div className="section-heading"><div><p className="eyebrow">Caja Activa</p><h2>Control</h2></div><span className={`cash-state ${cash ? "open" : ""}`}>{cash ? "Abierta" : "Cerrada"}</span></div>
                <div className="action-grid mt-4">
                  {!cash && <button type="button" className="primary-action w-full" onClick={() => setModal("open")}>Abrir nueva caja</button>}
                  {cash && <button type="button" className="secondary-action w-full mt-0" onClick={() => setModal("movement")}>Registrar Movimiento</button>}
                  {cash && <button type="button" className="primary-action w-full bg-red-600 hover:bg-red-700" onClick={() => setModal("close")}>Cerrar Turno</button>}
                </div>
              </section>
            </aside>
         </div>
      )}

      {/* VISTA INVENTARIO */}
      {activeTab === "Inventario" && (
        <div className="flex flex-col gap-6">
          <section className="panel">
            <div className="section-heading"><div><p className="eyebrow">Catálogo Completo</p><h2>Inventario Avanzado</h2></div></div>
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input className="w-full border p-2.5 rounded text-sm outline-none focus:border-black" value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} placeholder="Buscar por SKU, código o nombre..." />
              </div>
              <div className="w-48">
                <select className="w-full border p-2.5 rounded text-sm outline-none bg-white" value={invCategoryFilter} onChange={e => setInvCategoryFilter(e.target.value)}>
                  {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
            
            <div className="cart-table-wrap">
              <table>
                <thead><tr><th>Producto</th><th>Categoría</th><th>SKU</th><th>Stock Actual</th><th className="align-right">Precio Venta</th></tr></thead>
                <tbody>
                  {filteredInventory.length === 0 ? <tr><td colSpan={5} className="empty-state">No se encontraron productos.</td></tr> : filteredInventory.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.nombre || "Producto"}</strong></td>
                      <td className="text-xs text-gray-500 uppercase tracking-wider">{p.categoria}</td>
                      <td className="muted">{p.sku}</td>
                      <td><span className={p.stockActual <= p.stockMinimo ? "muted" : ""} style={{fontWeight: 700, color: p.stockActual <= p.stockMinimo ? "var(--red)" : "inherit"}}>{p.stockActual}</span></td>
                      <td className="align-right price">${p.precioVenta.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* VISTA CUENTAS POR COBRAR */}
      {activeTab === "Cuentas por cobrar" && (
         <div className="flex flex-col gap-6">
            <section className="panel" style={{gridColumn: "1 / -1"}}>
              <div className="section-heading mb-0"><div><p className="eyebrow">CRM Selectivo</p><h2>Créditos y Cobranzas</h2></div></div>
              
              <div className="flex border-b mb-6 mt-6">
                <button className={`pb-3 px-4 text-sm font-semibold border-b-2 ${receivableTab === "todas" ? "border-black text-black" : "border-transparent text-gray-400"}`} onClick={() => setReceivableTab("todas")}>Historial General</button>
                <button className={`pb-3 px-4 text-sm font-semibold border-b-2 ${receivableTab === "hoy" ? "border-black text-black" : "border-transparent text-gray-400"}`} onClick={() => setReceivableTab("hoy")}>Generados Hoy</button>
              </div>

              <div className="cart-table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Referencia</th><th>Estado</th><th className="align-right">Saldo Deudor</th><th className="align-right">Acciones</th></tr></thead>
                  <tbody>
                    {filteredReceivables.length === 0 ? <tr><td colSpan={5} className="empty-state">No hay cuentas por cobrar en este filtro.</td></tr> : filteredReceivables.map(acc => (
                      <tr key={acc.id}>
                        <td><strong>{acc.cliente_nombre}</strong></td>
                        <td className="muted">{acc.referencia}</td>
                        <td>
                           <span className="cash-state" style={{background: acc.estado === "pendiente" ? "#fff0d5" : acc.estado === "pagada" ? "#e8f4bb" : "#fce5e1", color: acc.estado === "pendiente" ? "#a16a14" : acc.estado === "pagada" ? "#687332" : "#b04f47"}}>{acc.estado.toUpperCase()}</span>
                        </td>
                        <td className="align-right price">${Number(acc.saldo).toFixed(2)}</td>
                        <td className="align-right">
                           {acc.estado !== "pagada" ? (
                              <div className="flex gap-2 justify-end">
                                 <button type="button" className="secondary-action !py-1 !px-2 text-xs" disabled={!cash} onClick={() => cash ? markAsPaid(acc) : showToast("Debe aperturar la caja del día para recibir pagos")}>Cobrado</button>
                                 <button type="button" className="primary-action !py-1 !px-2 text-xs" disabled={!cash} onClick={() => cash ? setPaymentModalData(acc) : showToast("Debe aperturar la caja del día para recibir pagos")}>Abonar</button>
                              </div>
                           ) : (
                              <span className="muted font-semibold text-xs uppercase">Completado</span>
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
          <h2 id="modal-title">Cobrar a {paymentModalData.cliente_nombre}</h2>
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
             <button className="primary-action modal-submit" type="submit">Confirmar Cobro</button>
          </form>
        </section>
      </div>
    )}
  </main>;
}
