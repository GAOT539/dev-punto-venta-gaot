"use client";

import Image from "next/image";
import React, { FormEvent, useEffect, useState, useMemo } from "react";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { toast } from "sonner";

type Product = { id: number; sku: string; nombre: string | null; categoria: string; precioVenta: number; costo: number; stockActual: number; stockMinimo: number };
type CartItem = Product & { cantidad: number };
type Cash = { id: number; montoInicial: number; efectivoEsperado: number | null; estado: "abierta" | "cerrada" } | null;
type Modal = "open" | "close" | "movement" | null;
type Account = { id: number; cliente_nombre: string; monto_original: number; saldo: number; estado: string; fecha_vencimiento: string | null, created_at?: string };
type Payable = { id: number; proveedor_id: number; proveedor_nombre: string; numero_factura: string; monto_original: number; saldo: number; estado: string; created_at: string };
type PayablePayment = { id: number; factura_proveedor_id: number; monto: number; metodo_pago: string; created_at: string };
type SaleRec = { id: number, created_at: string, metodo_pago: string, total: string | number };
type MovRec = { id: number, created_at: string, concepto: string, tipo: string, monto: string | number, metodo_pago?: string };
type UnifiedOp = { id: string; realId: number; isSale: boolean; hora: string; dateObj: Date; metodo: string; tipo: string; total: number; concepto?: string };

const navItems = ["Resumen", "Reportes", "Punto de venta", "Historial / Caja", "Inventario", "Cuentas por pagar"];
const COLORS = ['#88c9dd', '#cfe86b', '#f3b45c', '#e77c70', '#8b5cf6', '#3b82f6'];

export default function Home() {
  const [activeTab, setActiveTab] = useState("Resumen");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dashboard
  const [dashboard, setDashboard] = useState<{ cuentasPorPagar?: number; ventasTotalesMes?: number; egresosTotalesMes?: number; egresosHoy?: number; valorInventario?: number; rankingMejoresDias?: {fecha: string; total: number; cantidad: number; egresos: number; neto: number; margen: number}[]; desgloseHoy?: {metodo: string; total: number}[] } | null>(null);

  // Reports
  const [reports, setReports] = useState<any>(null);

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
  const [salesDate, setSalesDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }));
  const [salesData, setSalesData] = useState<{ventas: SaleRec[], movimientos: MovRec[]}>({ventas: [], movimientos: []});
  const [expandedOp, setExpandedOp] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<{id: number, producto_nombre: string, cantidad: number, subtotal: number | string}[]>([]);

  // Inventory States
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryResults, setInventoryResults] = useState<Product[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<Product[]>([]);
  const [invCategoryFilter, setInvCategoryFilter] = useState("Todas");
  const [productModal, setProductModal] = useState<Partial<Product> | null>(null);
  const [invSortConfig, setInvSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>({ key: 'nombre', direction: 'asc' });

  const requestInvSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (invSortConfig && invSortConfig.key === key && invSortConfig.direction === 'asc') direction = 'desc';
    setInvSortConfig({ key, direction });
  };

  // Reports States
  const [reportsStartDate, setReportsStartDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }));
  const [reportsEndDate, setReportsEndDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }));

  // Receivables States
  const [receivables, setReceivables] = useState<Account[]>([]);
  const [paymentModalData, setPaymentModalData] = useState<Account | null>(null);
  const [receivableTab, setReceivableTab] = useState<"hoy" | "todas">("todas");

  // Payables States
  const [payables, setPayables] = useState<Payable[]>([]);
  const [payablePayments, setPayablePayments] = useState<PayablePayment[]>([]);
  const [expandedPayable, setExpandedPayable] = useState<number | null>(null);
  const [payableModalData, setPayableModalData] = useState<Payable | null>(null);
  const [newPayableModal, setNewPayableModal] = useState(false);

  // Trigger Refreshes
  async function fetchProducts() {
    try { const res = await fetch("/api/products"); const data = await res.json(); setInventoryResults(data.products || []); } catch {}
  }
  async function fetchReceivablesData() {
    try { const res = await fetch("/api/receivables"); const data = await res.json(); setReceivables(data.accounts || []); } catch {}
  }
  async function fetchPayablesData() {
    try { const res = await fetch("/api/payables"); const data = await res.json(); setPayables(data.payables || []); setPayablePayments(data.payments || []); } catch {}
  }
  async function fetchHistoryData() {
    try { const res = await fetch(`/api/sales?date=${salesDate}`); const data = await res.json(); if (!data.error) setSalesData(data); } catch {}
  }

  async function fetchReportsData() {
    try { 
       let url = "/api/reports";
       if (reportsStartDate && reportsEndDate) {
         url += `?from=${reportsStartDate}&to=${reportsEndDate}`;
       }
       const res = await fetch(url); 
       const data = await res.json(); 
       setReports(data); 
    } catch {}
  }

  function revalidateAll() {
    fetch("/api/cash").then((response) => response.json()).then((data) => setCash(data.caja ?? null)).catch(() => undefined);
    fetch("/api/inventory/alerts").then(res => res.json()).then(data => setInventoryAlerts(data.products || [])).catch(() => undefined);
    if (activeTab === "Resumen") fetch("/api/dashboard").then(res => res.json()).then(setDashboard).catch(() => undefined);
    if (activeTab === "Reportes") fetchReportsData();
    if (activeTab === "Inventario") fetchProducts();
    if (activeTab === "Cuentas por cobrar") fetchReceivablesData();
    if (activeTab === "Cuentas por pagar") fetchPayablesData();
    if (activeTab === "Historial / Caja" || activeTab === "Punto de venta") fetchHistoryData();
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { revalidateAll(); }, [activeTab]);
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if(activeTab === "Historial / Caja") fetchHistoryData(); }, [salesDate]);

  function showToast(msg: string) {
    if (/error|insuficiente|no se pudo|debe/i.test(msg)) {
      toast.error(msg);
    } else {
      toast.success(msg);
    }
  }

  // --- POS Functions ---
  useEffect(() => {
    const term = code.trim();
    if (term.length < 2) { const timer = setTimeout(() => setSuggestions([]), 0); return () => clearTimeout(timer); }
    const timer = setTimeout(async () => {
      try { const response = await fetch(`/api/products?code=${encodeURIComponent(term)}`); const data = await response.json(); setSuggestions(data.products ?? (data.id ? [data] : [])); } catch { setSuggestions([]); }
    }, 180);
    return () => clearTimeout(timer);
  }, [code]);

  function addToCart(product: Product) {
    const existing = cart.find((item) => item.id === product.id);
    const nextQuantity = existing ? existing.cantidad + 1 : 1;
    if (nextQuantity > product.stockActual) {
      showToast("Stock insuficiente");
      return;
    }
    setCart((current) => { const existing = current.find((item) => item.id === product.id); return existing ? current.map((item) => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item) : [...current, { ...product, cantidad: 1 }]; });
    setCode(""); setSuggestions([]); setMessage("Producto agregado");
  }

  async function searchProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const term = code.trim(); if (!term) return;
    try { const response = await fetch(`/api/products?code=${encodeURIComponent(term)}`); const data = await response.json(); if (data.id) addToCart(data); else if (data.products?.length === 1) addToCart(data.products[0]); else setMessage(data.products?.length ? "Selecciona un producto" : "No encontrado"); } catch { setMessage("DB no disponible"); }
  }

  function changeQuantity(id: number, amount: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.id === id) {
        if (amount > 0 && item.cantidad + amount > item.stockActual) {
          showToast("Stock insuficiente");
          return [item];
        }
        return item.cantidad + amount > 0 ? [{ ...item, cantidad: item.cantidad + amount }] : [];
      }
      return [item];
    }));
  }

  async function chargeSale() {
    if (!cash || cart.length === 0 || isSubmitting) return;
    if (paymentMethod === "CREDITO" && !creditCustomer.trim()) { setMessage("Indica el cliente"); return; }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cajaTurnoId: cash.id, metodoPago: paymentMethod, clienteCredito: paymentMethod === "CREDITO" ? { nombre: creditCustomer.trim() } : undefined, lineas: cart.map((item) => ({ varianteId: item.id, cantidad: item.cantidad })) }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "No se pudo registrar"); return; }
      setCart([]); setCreditCustomer(""); showToast("¡Cobrado con éxito!"); setMessage(`Venta #${data.id} registrada`);
      await fetchHistoryData();
      revalidateAll();
    } finally { setIsSubmitting(false); }
  }

  // --- Cash Functions ---
  async function submitCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (isSubmitting) return; setIsSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      const action = modal === "open" ? "open" : modal === "close" ? "close" : "movement";
      const body = action === "open" ? { action, montoInicial: Number(form.get("monto")) } : action === "close" ? { action, id: cash?.id, efectivoReal: Number(form.get("monto")) } : { cajaTurnoId: cash?.id, tipo: form.get("tipo"), monto: Number(form.get("monto")), concepto: form.get("concepto") };
      const response = await fetch("/api/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { showToast(data.error ?? "Error en caja"); return; }
      setModal(null); showToast("Operación de caja registrada");
      revalidateAll();
    } finally { setIsSubmitting(false); }
  }

  // --- Inventory Functions ---
  async function submitProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (isSubmitting) return; setIsSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const body = { nombre: form.get("nombre"), sku: form.get("sku"), precioVenta: Number(form.get("precioVenta")), costo: Number(form.get("costo")), stockInicial: Number(form.get("stockActual")), stockActual: Number(form.get("stockActual")), stockMinimo: Number(form.get("stockMinimo")) };
      const url = productModal?.id ? `/api/products/${productModal.id}` : "/api/products";
      const method = productModal?.id ? "PUT" : "POST";
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { showToast("Error al guardar producto"); return; }
      setProductModal(null); showToast("Producto guardado");
      revalidateAll();
    } finally { setIsSubmitting(false); }
  }

  // --- Receivables Functions ---
  async function submitPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(isSubmitting) return; setIsSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/receivables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "payment", cuentaId: paymentModalData?.id, monto: Number(form.get("monto")), metodoPago: form.get("metodoPago"), cajaTurnoId: cash?.id }) });
      if(res.ok) { setPaymentModalData(null); showToast("Abono registrado"); revalidateAll(); } else { const err = await res.json(); showToast(err.error || "Error"); }
    } finally { setIsSubmitting(false); }
  }

  async function markAsPaid(acc: Account) {
    if(!cash) { showToast("Debe aperturar la caja del día"); return; }
    if(isSubmitting) return; setIsSubmitting(true);
    try {
      const res = await fetch("/api/receivables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "payment", cuentaId: acc.id, monto: acc.saldo, metodoPago: "efectivo", cajaTurnoId: cash.id }) });
      if(res.ok) { showToast("Cobrado exitosamente"); revalidateAll(); } else { showToast("Error al cobrar"); }
    } finally { setIsSubmitting(false); }
  }

  async function cancelReceivable(acc: Account) {
    if(!cash) { showToast("Debe aperturar la caja para registrar la anulación"); return; }
    if(!confirm(`¿Estás seguro de anular el pago de ${acc.cliente_nombre}? Esto regresará la cuenta a deuda y registrará un retiro en caja.`)) return;
    if(isSubmitting) return; setIsSubmitting(true);
    try {
      const res = await fetch(`/api/receivables/${acc.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cajaTurnoId: cash.id }) });
      if(res.ok) { showToast("Cobro anulado"); revalidateAll(); } else { showToast("Error al anular"); }
    } finally { setIsSubmitting(false); }
  }

  // --- Payables Functions ---
  async function submitPayablePayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(isSubmitting) return; setIsSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/payables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "payment", facturaId: payableModalData?.id, monto: Number(form.get("monto")), metodoPago: form.get("metodoPago"), cajaTurnoId: cash?.id }) });
      if(res.ok) { setPayableModalData(null); showToast("Abono registrado a proveedor"); revalidateAll(); } else { const err = await res.json(); showToast(err.error || "Error"); }
    } finally { setIsSubmitting(false); }
  }

  async function submitNewPayable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(isSubmitting) return; setIsSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/payables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", proveedor: form.get("proveedor"), factura: form.get("factura"), monto: Number(form.get("monto")) }) });
      if(res.ok) { setNewPayableModal(false); showToast("Deuda registrada"); revalidateAll(); } else { const err = await res.json(); showToast(err.error || "Error"); }
    } finally { setIsSubmitting(false); }
  }

  // --- Computed Values ---
  const filteredInventory = useMemo(() => {
    let list = [...inventoryResults];
    if (invCategoryFilter !== "Todas") list = list.filter(p => p.categoria === invCategoryFilter);
    if (inventorySearch.trim()) { const q = inventorySearch.toLowerCase(); list = list.filter(p => p.nombre?.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)); }
    
    if (invSortConfig) {
      list.sort((a, b) => {
        let aVal: any = a[invSortConfig.key as keyof Product] ?? "";
        let bVal: any = b[invSortConfig.key as keyof Product] ?? "";
        
        if (invSortConfig.key === 'margen') {
          aVal = (a.precioVenta || 0) - (a.costo || 0);
          bVal = (b.precioVenta || 0) - (b.costo || 0);
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return invSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return invSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return list;
  }, [inventoryResults, invCategoryFilter, inventorySearch, invSortConfig]);

  const uniqueCategories = useMemo(() => {
    return ["Todas", ...Array.from(new Set(inventoryResults.map(p => p.categoria).filter(Boolean)))];
  }, [inventoryResults]);

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
  const filteredReceivables = useMemo(() => {
    if (receivableTab === "todas") return receivables;
    return receivables.filter(r => r.created_at?.startsWith(todayStr));
  }, [receivables, receivableTab, todayStr]);

  const unifiedOperations = useMemo(() => {
    const ops: UnifiedOp[] = [];
    salesData.ventas.forEach(v => {
       const d = new Date(v.created_at);
       ops.push({ id: "venta-" + v.id, realId: v.id, isSale: true, hora: d.toLocaleTimeString('es-EC', {timeZone: 'America/Guayaquil'}), dateObj: d, metodo: v.metodo_pago, tipo: "Venta", total: Number(v.total) });
    });
    salesData.movimientos.forEach(m => {
       // Filtrar movimientos automáticos de venta
       if (m.tipo === 'venta') return;
       const d = new Date(m.created_at);
       ops.push({ id: "movimiento-" + m.id, realId: m.id, isSale: false, hora: d.toLocaleTimeString('es-EC', {timeZone: 'America/Guayaquil'}), dateObj: d, metodo: 'N/A', tipo: m.tipo, total: Number(m.monto), concepto: m.concepto });
    });
    return ops.sort((a,b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [salesData]);

  async function toggleExpand(op: UnifiedOp) {
    if (expandedOp === op.id) { setExpandedOp(null); return; }
    setExpandedOp(op.id);
    if (op.isSale) {
       setExpandedDetails([]); 
       try { const res = await fetch(`/api/sales/${op.realId}`); const data = await res.json(); setExpandedDetails(data.detalles || []); } catch { setExpandedDetails([]); }
    }
  }

  // Variables calculadas Caja Diaria
  const totalIngresos = salesData.ventas.filter(v => v.metodo_pago.toLowerCase() !== 'credito').reduce((sum, v) => sum + Number(v.total), 0) + 
                        salesData.movimientos.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto), 0);
  const totalIngresosEfectivo = salesData.ventas.filter(v => v.metodo_pago.toLowerCase() === 'efectivo').reduce((sum, v) => sum + Number(v.total), 0) + 
                                salesData.movimientos.filter(m => m.tipo === 'ingreso' && (!m.metodo_pago || m.metodo_pago.toLowerCase() === 'efectivo')).reduce((sum, m) => sum + Number(m.monto), 0);
  const totalIngresosTransferencia = salesData.ventas.filter(v => v.metodo_pago.toLowerCase() === 'transferencia').reduce((sum, v) => sum + Number(v.total), 0) + 
                                     salesData.movimientos.filter(m => m.tipo === 'ingreso' && m.metodo_pago?.toLowerCase() === 'transferencia').reduce((sum, m) => sum + Number(m.monto), 0);
  const totalEgresos = salesData.movimientos.filter(m => m.tipo === 'retiro').reduce((sum, m) => sum + Number(m.monto), 0);
  const desgloseVentasEfectivo = dashboard?.desgloseHoy?.find(d => d.metodo === 'efectivo')?.total || 0;
  const desgloseVentasTransf = dashboard?.desgloseHoy?.find(d => d.metodo === 'transferencia')?.total || 0;
  const desgloseVentasCredito = dashboard?.desgloseHoy?.find(d => d.metodo.toLowerCase() === 'credito')?.total || 0;

  return <main className="app-shell">
    
    <aside className="sidebar">
      <div className="brand"><Image src="/logo.png" alt="Punto de Venta" width={52} height={52} priority className="bg-transparent" /><div><strong>DPVG</strong><span>Punto de venta</span></div></div>
      <nav aria-label="Navegación principal">
        {navItems.map((item) => <button type="button" className={`nav-item ${activeTab === item ? "active" : ""}`} key={item} onClick={() => setActiveTab(item)}>{item}</button>)}
      </nav>
      <div className="sidebar-footer"><span className="status-dot" /> Zona Horaria (EC)</div>
    </aside>
    
    <section className="workspace relative">
      <header className="topbar">
        <div><p className="eyebrow">Operación diaria</p><h1>{activeTab}</h1></div>
        <div className="date-chip">{cash ? "Caja abierta" : "Sin turno"}<span>•</span> {new Date().toLocaleDateString('es-EC', {timeZone: 'America/Guayaquil'})}</div>
      </header>

      {activeTab === "Resumen" && (
        <div className="flex flex-col gap-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow">Ventas del Mes</p>
               <h2 className="text-3xl font-bold">${dashboard?.ventasTotalesMes?.toFixed(2) || "0.00"}</h2>
               <p className="text-xs text-gray-500">Total acumulado 30 días</p>
             </div>
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow">Egresos</p>
               <h2 className="text-3xl font-bold text-red-600">-${dashboard?.egresosHoy?.toFixed(2) || "0.00"}</h2>
               <p className="text-xs text-gray-500">Mes: -${dashboard?.egresosTotalesMes?.toFixed(2) || "0.00"}</p>
             </div>
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow">Desglose Día (Efectivo)</p>
               <h2 className="text-3xl font-bold text-green-700">${desgloseVentasEfectivo.toFixed(2)}</h2>
               <p className="text-xs text-gray-500">Ventas en caja de hoy</p>
             </div>
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow">Transferencias</p>
               <h2 className="text-2xl font-bold text-blue-700 mt-1">${desgloseVentasTransf.toFixed(2)}</h2>
               <p className="text-xs text-gray-500">Métodos alternativos hoy</p>
             </div>
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow">Valor Inventario</p>
               <h2 className="text-3xl font-bold">${dashboard?.valorInventario?.toFixed(2) || "0.00"}</h2>
               <p className="text-xs text-gray-500">Capital valorizado al costo</p>
             </div>
             <div className="panel flex flex-col gap-2">
               <p className="eyebrow text-red-600">Cuentas por Pagar</p>
               <h2 className="text-3xl font-bold">${dashboard?.cuentasPorPagar?.toFixed(2) || "0.00"}</h2>
               <p className="text-xs text-gray-500">Deuda a proveedores</p>
             </div>
           </div>

           <section className="panel">
              <div className="section-heading"><div><p className="eyebrow">Desempeño</p><h2>Historial de Ventas por Día</h2></div></div>
              <div className="cart-table-wrap mt-4">
                <table>
                  <thead><tr><th>Fecha</th><th className="align-right">Cant. Operaciones</th><th className="align-right">Volumen de Ventas</th><th className="align-right">Egresos</th><th className="align-right">Total (Neto)</th><th className="align-right">Margen</th></tr></thead>
                  <tbody>
                    {!dashboard?.rankingMejoresDias?.length ? (
                       <tr><td colSpan={6} className="empty-state">Sin historial de ventas.</td></tr>
                    ) : dashboard.rankingMejoresDias.map((d, idx: number) => (
                       <tr key={idx}>
                         <td><strong>{new Date(d.fecha).toLocaleDateString('es-EC', {timeZone: 'UTC'})}</strong></td>
                         <td className="align-right muted">{d.cantidad}</td>
                         <td className="align-right price text-green-600">${d.total.toFixed(2)}</td>
                         <td className="align-right price text-red-500">-${d.egresos.toFixed(2)}</td>
                         <td className="align-right price font-bold">${d.neto.toFixed(2)}</td>
                         <td className="align-right price font-bold text-green-700">${(d.margen || 0).toFixed(2)}</td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
        </div>
      )}

      {activeTab === "Reportes" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="panel flex flex-col gap-4">
              <div className="section-heading mb-0"><div><p className="eyebrow">Ingresos vs Egresos</p><h2>Últimos 6 Meses</h2></div></div>
              <div className="h-64 w-full">
                {reports?.graficas?.ingresosEgresos ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reports.graficas.ingresosEgresos} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e6e1" />
                      <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#777b76'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#777b76'}} tickFormatter={(val) => `$${val}`} />
                      <RechartsTooltip cursor={{fill: '#f5f6f2'}} contentStyle={{borderRadius: '8px', border: '1px solid #e4e6e1', fontSize: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                      <Bar dataKey="ingresos" name="Ingresos" fill="#88c9dd" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="egresos" name="Egresos" fill="#e77c70" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">Cargando...</div>}
              </div>
            </section>

            <section className="panel flex flex-col gap-4">
              <div className="section-heading mb-0"><div><p className="eyebrow">Evolución</p><h2>Ventas Últimos 15 Días</h2></div></div>
              <div className="h-64 w-full">
                {reports?.graficas?.ventasPorDia ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reports.graficas.ventasPorDia} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e6e1" />
                      <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#777b76'}} tickFormatter={(val) => val.substring(8, 10) + '/' + val.substring(5, 7)} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#777b76'}} tickFormatter={(val) => `$${val}`} />
                      <RechartsTooltip cursor={{stroke: '#e4e6e1', strokeWidth: 1}} contentStyle={{borderRadius: '8px', border: '1px solid #e4e6e1', fontSize: '12px'}} />
                      <Line type="monotone" dataKey="total" name="Total Ventas" stroke="#88c9dd" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">Cargando...</div>}
              </div>
            </section>

            <section className="panel flex flex-col gap-4">
              <div className="section-heading mb-0"><div><p className="eyebrow">Distribución</p><h2>Top 5 Productos Vendidos</h2></div></div>
              <div className="h-64 w-full">
                {reports?.graficas?.topProductos ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reports.graficas.topProductos} dataKey="cantidad" nameKey="nombre" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                        {reports.graficas.topProductos.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{borderRadius: '8px', border: '1px solid #e4e6e1', fontSize: '12px'}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '11px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">Cargando...</div>}
              </div>
            </section>

            <section className="panel flex flex-col gap-4">
              <div className="section-heading mb-0"><div><p className="eyebrow">Flujo</p><h2>Flujo de Caja Neto (15 Días)</h2></div></div>
              <div className="h-64 w-full">
                {reports?.graficas?.flujoCaja ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reports.graficas.flujoCaja} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e6e1" />
                      <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#777b76'}} tickFormatter={(val) => val.substring(8, 10) + '/' + val.substring(5, 7)} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#777b76'}} tickFormatter={(val) => `$${val}`} />
                      <RechartsTooltip cursor={{stroke: '#e4e6e1', strokeWidth: 1}} contentStyle={{borderRadius: '8px', border: '1px solid #e4e6e1', fontSize: '12px'}} />
                      <Area type="monotone" dataKey="neto" name="Neto" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">Cargando...</div>}
              </div>
            </section>

            <section className="panel flex flex-col gap-4">
              <div className="section-heading mb-0"><div><p className="eyebrow">Transacciones</p><h2>Horas Pico de Ventas</h2></div></div>
              <div className="h-64 w-full">
                {reports?.graficas?.horasPico ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reports.graficas.horasPico} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e6e1" />
                      <XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#777b76'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#777b76'}} />
                      <RechartsTooltip cursor={{fill: '#f5f6f2'}} contentStyle={{borderRadius: '8px', border: '1px solid #e4e6e1', fontSize: '12px'}} />
                      <Bar dataKey="tickets" name="Tickets" fill="#f3b45c" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">Cargando...</div>}
              </div>
            </section>

            <section className="panel flex flex-col gap-4">
              <div className="section-heading mb-0"><div><p className="eyebrow">Tendencia</p><h2>Métodos de Pago</h2></div></div>
              <div className="h-64 w-full">
                {reports?.graficas?.metodosPago ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reports.graficas.metodosPago} dataKey="cantidad" nameKey="nombre" cx="50%" cy="50%" outerRadius={80}>
                        {reports.graficas.metodosPago.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{borderRadius: '8px', border: '1px solid #e4e6e1', fontSize: '12px'}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '11px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">Cargando...</div>}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="panel">
               <div className="section-heading mb-4"><div><p className="eyebrow">Rentabilidad</p><h2>Top 5 Margen</h2></div></div>
               <div className="cart-table-wrap !min-h-0">
                 <table>
                   <thead><tr><th>Producto</th><th className="align-right">Margen</th></tr></thead>
                   <tbody>
                     {!reports?.listas?.topMargen?.length ? <tr><td colSpan={2} className="empty-state !py-6">Sin datos</td></tr> : reports.listas.topMargen.map((p: any, i: number) => (
                       <tr key={i}><td><strong>{p.nombre}</strong></td><td className="align-right price text-green-600">${Number(p.margen).toFixed(2)}</td></tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </section>

            <section className="panel">
               <div className="section-heading mb-4"><div><p className="eyebrow">Rendimiento</p><h2>Margen por Día</h2></div></div>
               <div className="cart-table-wrap !min-h-0">
                 <table>
                   <thead><tr><th>Fecha</th><th className="align-right">Ingresos</th><th className="align-right">Margen</th></tr></thead>
                   <tbody>
                     {!reports?.listas?.margenPorDia?.length ? <tr><td colSpan={3} className="empty-state !py-6">Sin datos</td></tr> : reports.listas.margenPorDia.map((m: any, i: number) => (
                       <tr key={i}><td><strong>{new Date(m.fecha).toLocaleDateString()}</strong></td><td className="align-right price text-gray-700">${Number(m.ingresos).toFixed(2)}</td><td className="align-right price font-bold text-green-600">${Number(m.margen).toFixed(2)}</td></tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </section>

            <section className="panel">
               <div className="section-heading mb-4"><div><p className="eyebrow">Riesgo</p><h2>Mayor Deuda Prov.</h2></div></div>
               <div className="cart-table-wrap !min-h-0">
                 <table>
                   <thead><tr><th>Proveedor</th><th className="align-right">Deuda</th></tr></thead>
                   <tbody>
                     {!reports?.listas?.proveedoresDeuda?.length ? <tr><td colSpan={2} className="empty-state !py-6">Sin datos</td></tr> : reports.listas.proveedoresDeuda.map((p: any, i: number) => (
                       <tr key={i}><td><strong>{p.nombre}</strong></td><td className="align-right price text-red-600">${Number(p.total_deuda).toFixed(2)}</td></tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </section>
          </div>

          <section className="panel mt-6">
             <div className="section-heading mb-4">
                <div><p className="eyebrow">Desglose</p><h2>Historial de Ventas (con Margen)</h2></div>
             </div>
             <div className="cart-table-wrap">
               <table>
                 <thead><tr><th>Ticket ID</th><th>Fecha</th><th>Método</th><th className="align-right">Total</th><th className="align-right">Costo</th><th className="align-right">Margen Ganancia</th></tr></thead>
                 <tbody>
                   {!reports?.listas?.historialVentas?.length ? <tr><td colSpan={6} className="empty-state py-6">Sin datos para el período seleccionado.</td></tr> : reports.listas.historialVentas.map((v: any) => (
                     <tr key={v.ticket}>
                       <td><strong>#{v.ticket}</strong></td>
                       <td>{new Date(v.created_at).toLocaleString('es-EC', {timeZone: 'America/Guayaquil'})}</td>
                       <td className="capitalize">{v.metodo_pago}</td>
                       <td className="align-right price text-blue-700 font-semibold">${Number(v.total).toFixed(2)}</td>
                       <td className="align-right price text-gray-500">${Number(v.costo_total).toFixed(2)}</td>
                       <td className="align-right price text-green-700 font-bold">${Number(v.margen).toFixed(2)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </section>
        </div>
      )}

      {activeTab === "Punto de venta" && (
        <div className="flex flex-col lg:flex-row gap-6">
          <section className="pos-panel panel flex-1">
            <div className="section-heading"><div><p className="eyebrow">Venta rápida</p><h2>Escanear productos</h2></div><span className="kbd">ENTER</span></div>
            <form className="scanner search-box" onSubmit={searchProduct}>
              <span className="scan-icon">⌕</span>
              <input autoFocus value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código, SKU o nombre del producto" />
              <button type="submit">Agregar</button>
              {suggestions.length > 0 && <div className="suggestions" role="listbox">{suggestions.map((product) => <button type="button" role="option" aria-selected="false" key={product.id} onClick={() => addToCart(product)}><span><strong>{product.nombre || "Producto"}</strong><small>{product.sku}</small></span><b>${product.precioVenta.toFixed(2)}</b></button>)}</div>}
            </form>
            <p className="helper-text">{message}</p>
            <div className="cart-table-wrap">
              <table>
                <thead><tr><th>Producto</th><th>SKU</th><th>Cantidad</th><th className="align-right">Subtotal</th></tr></thead>
                <tbody>
                  {cart.length === 0 ? <tr><td colSpan={4} className="empty-state">Escanea o busca un producto</td></tr> : cart.map((item) => <tr key={item.id}><td><strong>{item.nombre || "Producto"}</strong></td><td className="muted">{item.sku}</td><td><div className="quantity"><button type="button" onClick={() => changeQuantity(item.id, -1)}>−</button><span>{item.cantidad}</span><button type="button" onClick={() => changeQuantity(item.id, 1)}>+</button></div></td><td className="align-right price">${(item.precioVenta * item.cantidad).toFixed(2)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="checkout">
              <div><span>Total a cobrar</span><strong>${total.toFixed(2)}</strong></div>
              <div className="checkout-controls">
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="CREDITO" disabled={true} className="opacity-50 cursor-not-allowed" title="No disponible temporalmente">Crédito</option></select>
                {paymentMethod === "CREDITO" && <input value={creditCustomer} onChange={(event) => setCreditCustomer(event.target.value)} placeholder="Cliente" />}
                
                <div className="flex flex-col items-end">
                   <button type="button" className={`primary-action ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`} disabled={!cash || cart.length === 0 || isSubmitting} onClick={chargeSale}>Cobrar venta <span>→</span></button>
                   {!cash && <p className="text-red-500 text-xs mt-2 font-bold absolute bottom-2">Debe abrir la caja para poder registrar ventas</p>}
                </div>
              </div>
            </div>
          </section>
          
          <aside className="w-full lg:w-80 flex flex-col gap-6">
            <section className="metric-row">
              <div className="metric-card"><span>Ventas del día</span><strong>${(totalIngresosEfectivo + totalIngresosTransferencia - totalEgresos).toFixed(2)}</strong><small>Acumulado hoy</small></div>
              <div className="metric-card accent"><span>Artículos</span><strong>{cart.reduce((s, i) => s + i.cantidad, 0)}</strong><small>En el carrito</small></div>
            </section>
            
            <section className="panel alerts">
              <div className="section-heading"><div><p className="eyebrow">Requiere atención</p><h2>Alertas</h2></div><button type="button" className="text-button" onClick={() => setActiveTab("Inventario")}>Ver inventario</button></div>
              {inventoryAlerts.length > 0 ? (
                <div className="alert-item orange"><span>!</span><div><strong>Stock mínimo</strong><p>Hay {inventoryAlerts.length} producto(s) por debajo del mínimo</p></div></div>
              ) : <p className="muted" style={{fontSize: "12px", marginTop: "10px"}}>Sin alertas de stock.</p>}
            </section>
            
            <section className="panel cash-actions">
              <div className="section-heading"><div><p className="eyebrow">Caja</p><h2>{cash ? "Caja abierta" : "Caja disponible"}</h2></div><span className={`cash-state ${cash ? "open" : ""}`}>{cash ? "Activa" : "Lista"}</span></div>
              <p>{cash ? `Efectivo inicial $${cash.montoInicial.toFixed(2)}` : "Para facturar, apertura una caja."}</p>
              <div className="action-grid mt-4">
                  {!cash && <button type="button" className="primary-action w-full" onClick={() => setModal("open")}>Abrir caja</button>}
                  {cash && <button type="button" className="secondary-action w-full bg-gray-100 text-gray-800 border-gray-300 font-semibold" onClick={() => setModal("movement")}>Registrar Movimiento</button>}
                  {cash && <button type="button" className="primary-action w-full mt-2 bg-red-600 hover:bg-red-700" onClick={() => setModal("close")}>Cerrar caja</button>}
              </div>
            </section>
          </aside>
        </div>
      )}

      {activeTab === "Historial / Caja" && (
         <div className="flex flex-col md:flex-row gap-6">
            <section className="panel flex-1">
              <div className="section-heading">
                <div><p className="eyebrow">Reportes</p><h2>Historial de Ventas y Movimientos</h2></div>
                <input type="date" value={salesDate} onChange={e => setSalesDate(e.target.value)} className="border p-2 rounded text-sm outline-none focus:border-black" />
              </div>
              <div className="cart-table-wrap">
                <table>
                  <thead><tr><th>Ticket ID</th><th>Hora</th><th>Método</th><th>Tipo</th><th className="align-right">Total</th></tr></thead>
                  <tbody>
                    {unifiedOperations.length === 0 ? <tr><td colSpan={5} className="empty-state">No hay operaciones registradas.</td></tr> : unifiedOperations.map(op => (
                      <React.Fragment key={op.id}>
                         <tr onClick={() => toggleExpand(op)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                           <td><strong>{op.isSale ? `#${op.realId}` : '-'}</strong></td>
                           <td className="muted">{op.hora}</td>
                           <td className="capitalize">{op.metodo}</td>
                           <td className="capitalize">{op.tipo}</td>
                           <td className={`align-right price font-bold ${op.tipo === 'retiro' ? 'text-red-500' : 'text-gray-800'}`}>
                              {op.tipo === 'retiro' ? '-' : ''}${op.total.toFixed(2)}
                           </td>
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
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-500">Ingresos Efectivo</span>
                  <strong className="text-gray-700">${totalIngresosEfectivo.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-500">Ingresos Transferencia</span>
                  <strong className="text-gray-700">${totalIngresosTransferencia.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Ingresos Totales</span>
                  <strong className="text-green-600 font-bold">${totalIngresos.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Egresos Manuales</span>
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
                  {!cash && <button type="button" className="primary-action w-full" onClick={() => setModal("open")}>Abrir caja</button>}
                  {cash && <button type="button" className="secondary-action w-full mt-0 bg-gray-100 text-gray-800 border-gray-300 font-semibold" onClick={() => setModal("movement")}>Registrar Movimiento</button>}
                  {cash && <button type="button" className="primary-action w-full mt-2 bg-red-600 hover:bg-red-700" onClick={() => setModal("close")}>Cerrar caja</button>}
                </div>
              </section>
            </aside>
         </div>
      )}

      {activeTab === "Inventario" && (
        <div className="flex flex-col gap-6">
          <section className="panel">
            <div className="section-heading">
               <div><p className="eyebrow">Catálogo Completo</p><h2>Inventario</h2></div>
               <button className="primary-action text-sm !py-2 !px-4" onClick={() => setProductModal({})}>+ Agregar Producto</button>
            </div>
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
                <thead>
                  <tr>
                    <th onClick={() => requestInvSort('nombre')} className="cursor-pointer select-none hover:bg-gray-100">Producto {invSortConfig?.key === 'nombre' ? (invSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestInvSort('categoria')} className="cursor-pointer select-none hover:bg-gray-100">Categoría {invSortConfig?.key === 'categoria' ? (invSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestInvSort('sku')} className="cursor-pointer select-none hover:bg-gray-100">SKU {invSortConfig?.key === 'sku' ? (invSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestInvSort('stockActual')} className="cursor-pointer select-none hover:bg-gray-100">Stock Actual {invSortConfig?.key === 'stockActual' ? (invSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestInvSort('stockMinimo')} className="cursor-pointer select-none hover:bg-gray-100">Stock Mín. {invSortConfig?.key === 'stockMinimo' ? (invSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestInvSort('costo')} className="align-right cursor-pointer select-none hover:bg-gray-100">Costo {invSortConfig?.key === 'costo' ? (invSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestInvSort('precioVenta')} className="align-right cursor-pointer select-none hover:bg-gray-100">Precio Venta {invSortConfig?.key === 'precioVenta' ? (invSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestInvSort('margen')} className="align-right cursor-pointer select-none hover:bg-gray-100">Margen {invSortConfig?.key === 'margen' ? (invSortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.length === 0 ? <tr><td colSpan={8} className="empty-state">No se encontraron productos.</td></tr> : filteredInventory.map(p => (
                    <tr key={p.id} onDoubleClick={() => setProductModal(p)} className="cursor-pointer hover:bg-gray-50 transition-colors" title="Doble clic para editar">
                      <td><strong>{p.nombre || "Producto"}</strong></td>
                      <td className="text-xs text-gray-500 uppercase tracking-wider">{p.categoria}</td>
                      <td className="muted">{p.sku}</td>
                      <td><span className={p.stockActual <= p.stockMinimo ? "text-red-600 font-bold" : "font-medium"}>{p.stockActual}</span></td>
                      <td><span className="muted">{p.stockMinimo}</span></td>
                      <td className="align-right price muted">${p.costo.toFixed(2)}</td>
                      <td className="align-right price font-bold text-gray-900">${p.precioVenta.toFixed(2)}</td>
                      <td className="align-right price text-green-700 font-bold">${(p.precioVenta - p.costo).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">* Doble clic sobre un producto para editarlo.</p>
            </div>
          </section>
        </div>
      )}

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
                  <thead><tr><th>Cliente</th><th>Estado</th><th className="align-right">Deuda Original</th><th className="align-right">Saldo Deudor</th><th className="align-right">Acciones</th></tr></thead>
                  <tbody>
                    {filteredReceivables.length === 0 ? <tr><td colSpan={5} className="empty-state">No hay cuentas.</td></tr> : filteredReceivables.map(acc => (
                      <tr key={acc.id} onDoubleClick={() => acc.estado === 'pagada' ? cancelReceivable(acc) : null} className={acc.estado === 'pagada' ? 'cursor-pointer hover:bg-gray-50' : ''} title={acc.estado === 'pagada' ? 'Doble clic para anular cobro' : ''}>
                        <td><strong>{acc.cliente_nombre}</strong></td>
                        <td><span className="cash-state" style={{background: acc.estado === "pendiente" ? "#fff0d5" : acc.estado === "pagada" ? "#e8f4bb" : "#fce5e1", color: acc.estado === "pendiente" ? "#a16a14" : acc.estado === "pagada" ? "#687332" : "#b04f47"}}>{acc.estado.toUpperCase()}</span></td>
                        <td className="align-right price text-gray-400">${Number(acc.monto_original).toFixed(2)}</td>
                        <td className="align-right price font-bold">${Number(acc.saldo).toFixed(2)}</td>
                        <td className="align-right">
                           {acc.estado !== "pagada" ? (
                              <button type="button" className="primary-action !py-1 !px-4 text-xs font-bold bg-green-600 hover:bg-green-700 text-white border-0" disabled={!cash || isSubmitting} onClick={() => cash ? markAsPaid(acc) : showToast("Debe aperturar caja")}>Cobrar Total</button>
                           ) : (
                              <span className="muted font-semibold text-xs uppercase text-gray-400">Pagado</span>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-2">* Doble clic sobre una cuenta PAGADA para anular el cobro.</p>
              </div>
            </section>
         </div>
      )}

      {/* VISTA CUENTAS POR PAGAR (PROVEEDORES) */}
      {activeTab === "Cuentas por pagar" && (
         <div className="flex flex-col gap-6">
            <section className="panel">
              <div className="section-heading mb-0">
                 <div><p className="eyebrow">Proveedores</p><h2>Cuentas por Pagar</h2></div>
                 <button className="primary-action text-sm !py-2 !px-4" onClick={() => setNewPayableModal(true)}>+ Ingresar</button>
              </div>
              
              <div className="cart-table-wrap mt-6">
                <table>
                  <thead><tr><th>Proveedor</th><th>Factura</th><th>Estado</th><th className="align-right">Abonos</th><th className="align-right">Deuda Total</th><th className="align-right">Acciones</th></tr></thead>
                  <tbody>
                    {payables.length === 0 ? <tr><td colSpan={6} className="empty-state">No hay facturas registradas.</td></tr> : payables.map(p => {
                      const abonosRelacionados = payablePayments.filter(pay => pay.factura_proveedor_id === p.id);
                      const totalAbonado = abonosRelacionados.reduce((sum, pay) => sum + Number(pay.monto), 0);
                      
                      return (
                      <React.Fragment key={p.id}>
                        <tr onClick={() => setExpandedPayable(expandedPayable === p.id ? null : p.id)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                          <td><strong>{p.proveedor_nombre}</strong></td>
                          <td className="muted text-sm">{p.numero_factura}</td>
                          <td><span className="cash-state" style={{background: p.estado === "pendiente" ? "#fff0d5" : p.estado === "pagada" ? "#e8f4bb" : "#fce5e1", color: p.estado === "pendiente" ? "#a16a14" : p.estado === "pagada" ? "#687332" : "#b04f47"}}>{p.estado.toUpperCase()}</span></td>
                          <td className="align-right price text-green-600">${totalAbonado.toFixed(2)}</td>
                          <td className="align-right price font-bold text-red-600">${Number(p.saldo).toFixed(2)}</td>
                          <td className="align-right" onClick={(e) => e.stopPropagation()}>
                             {p.estado !== "pagada" ? (
                                <button type="button" className="primary-action !py-1 !px-3 text-xs bg-gray-900 text-white hover:bg-black" disabled={!cash || isSubmitting} onClick={() => cash ? setPayableModalData(p) : showToast("Debe aperturar caja para pagar")}>Abonar</button>
                             ) : (
                                <span className="muted font-semibold text-xs uppercase text-gray-400">Completado</span>
                             )}
                          </td>
                        </tr>
                        {expandedPayable === p.id && (
                           <tr className="bg-gray-50 border-b"><td colSpan={6} className="p-4">
                              <div className="text-sm mb-2 font-semibold text-gray-700">Historial de Abonos:</div>
                              {abonosRelacionados.length > 0 ? (
                                <div className="bg-white rounded border overflow-hidden">
                                   <table className="w-full text-sm">
                                     <thead className="bg-gray-100"><tr><th className="p-2 text-left text-xs font-semibold">Fecha</th><th className="p-2 text-center text-xs font-semibold">Método</th><th className="p-2 text-right text-xs font-semibold">Monto</th></tr></thead>
                                     <tbody>
                                       {abonosRelacionados.map(abono => (
                                         <tr key={abono.id} className="border-t"><td className="p-2">{new Date(abono.created_at).toLocaleString('es-EC', {timeZone: 'America/Guayaquil'})}</td><td className="p-2 text-center capitalize">{abono.metodo_pago}</td><td className="p-2 text-right font-bold text-green-700">${Number(abono.monto).toFixed(2)}</td></tr>
                                       ))}
                                     </tbody>
                                   </table>
                                </div>
                              ) : <span className="text-xs text-gray-500 font-medium">No hay abonos registrados para esta factura.</span>}
                           </td></tr>
                        )}
                      </React.Fragment>
                    )})}
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
          <p className="modal-copy">{modal === "open" ? "Registra el efectivo disponible al iniciar el turno." : modal === "close" ? "Indica el efectivo físico en gaveta. Las ventas por tarjeta/transferencia NO suman al esperado." : "Registra un ingreso o retiro con su concepto."}</p>
          <form onSubmit={submitCash}>
            {modal === "movement" && (
              <>
                <label>Tipo<select name="tipo" defaultValue="ingreso"><option value="ingreso">Ingreso</option><option value="retiro">Egreso</option></select></label>
                <label>Concepto<input name="concepto" required placeholder="Ej. pago de servicio" /></label>
              </>
            )}
            <label>{modal === "close" ? "Efectivo físico contado" : "Monto"}<input name="monto" type="number" min="0" step="0.01" required autoFocus /></label>
            <button className={"primary-action modal-submit " + (isSubmitting ? "opacity-50" : "")} disabled={isSubmitting} type="submit">{isSubmitting ? "Guardando..." : "Guardar operación"}</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL ABONO CLIENTES */}
    {paymentModalData && (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button type="button" className="modal-close" onClick={() => setPaymentModalData(null)} aria-label="Cerrar">×</button>
          <p className="eyebrow">CRM - Abono de Cliente</p>
          <h2 id="modal-title">Cobrar a {paymentModalData.cliente_nombre}</h2>
          <p className="modal-copy" style={{marginBottom: "20px"}}>Saldo actual: <strong style={{fontSize: "16px"}}>${Number(paymentModalData.saldo).toFixed(2)}</strong></p>
          <form onSubmit={submitPayment}>
             <label>Método de pago
               <select name="metodoPago" defaultValue="efectivo"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select>
             </label>
             <label>Monto a abonar
               <input name="monto" type="number" min="0.01" max={Number(paymentModalData.saldo)} step="0.01" required autoFocus />
             </label>
             <button className={"primary-action modal-submit " + (isSubmitting ? "opacity-50" : "")} disabled={isSubmitting} type="submit">Confirmar Cobro</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL ABONO PROVEEDORES */}
    {payableModalData && (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button type="button" className="modal-close" onClick={() => setPayableModalData(null)} aria-label="Cerrar">×</button>
          <p className="eyebrow">Cuentas por Pagar - Pago</p>
          <h2 id="modal-title">Pagar a {payableModalData.proveedor_nombre}</h2>
          <p className="modal-copy" style={{marginBottom: "20px"}}>Deuda pendiente: <strong style={{fontSize: "16px"}}>${Number(payableModalData.saldo).toFixed(2)}</strong></p>
          <form onSubmit={submitPayablePayment}>
             <label>Método de pago
               <select name="metodoPago" defaultValue="efectivo"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select>
             </label>
             <label>Monto a pagar
               <input name="monto" type="number" min="0.01" max={Number(payableModalData.saldo)} step="0.01" required autoFocus />
             </label>
             <p className="text-xs text-red-500 mb-4">* Este monto será descontado (retiro) de la caja activa automáticamente.</p>
             <button className={"primary-action modal-submit " + (isSubmitting ? "opacity-50" : "")} disabled={isSubmitting} type="submit">Confirmar Pago</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL NUEVA CUENTA POR PAGAR */}
    {newPayableModal && (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button type="button" className="modal-close" onClick={() => setNewPayableModal(false)} aria-label="Cerrar">×</button>
          <p className="eyebrow">Proveedores</p>
          <h2 id="modal-title">Ingresar Deuda / Factura</h2>
          <form onSubmit={submitNewPayable} className="mt-4">
             <label>Nombre del Proveedor
               <input name="proveedor" required autoFocus placeholder="Ej. Distribuidora XYZ" />
             </label>
             <label>Factura o Concepto
               <input name="factura" required placeholder="Ej. FACT-001 o Mercadería" />
             </label>
             <label>Deuda Total a Pagar
               <input name="monto" type="number" min="0.01" step="0.01" required />
             </label>
             <button className={"primary-action modal-submit " + (isSubmitting ? "opacity-50" : "")} disabled={isSubmitting} type="submit">Guardar Deuda</button>
          </form>
        </section>
      </div>
    )}

    {/* MODAL INVENTARIO (CRUD) */}
    {productModal !== null && (
      <div className="modal-backdrop" role="presentation">
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{maxWidth: '500px'}}>
          <button type="button" className="modal-close" onClick={() => setProductModal(null)} aria-label="Cerrar">×</button>
          <p className="eyebrow">Inventario</p>
          <h2 id="modal-title">{productModal.id ? "Editar Producto" : "Nuevo Producto"}</h2>
          <form onSubmit={submitProduct} className="grid grid-cols-2 gap-4 mt-4">
             <label className="col-span-2">Nombre del producto<input name="nombre" defaultValue={productModal.nombre || ""} required autoFocus /></label>
             <label className="col-span-2">SKU / Código<input name="sku" defaultValue={productModal.sku || ""} /></label>
             <label>Costo ($)<input name="costo" type="number" step="0.01" min="0" defaultValue={productModal.costo || 0} required /></label>
             <label>PVP (Precio de Venta)<input name="precioVenta" type="number" step="0.01" min="0" defaultValue={productModal.precioVenta || 0} required /></label>
             <label>Stock Actual<input name="stockActual" type="number" step="0.001" min="0" defaultValue={productModal.stockActual || 0} required /></label>
             <label>Stock Mínimo (Alerta)<input name="stockMinimo" type="number" step="0.001" min="0" defaultValue={productModal.stockMinimo || 0} required /></label>
             <div className="col-span-2 mt-4 flex gap-4">
               <button className={"primary-action modal-submit flex-1 " + (isSubmitting ? "opacity-50" : "")} disabled={isSubmitting} type="submit">{productModal.id ? "Actualizar Cambios" : "Guardar Producto"}</button>
               {productModal.id && (
                 <button type="button" className={"primary-action modal-submit bg-red-600 hover:bg-red-700 " + (isSubmitting ? "opacity-50" : "")} disabled={isSubmitting} onClick={async () => {
                   if(confirm("¿Seguro que deseas eliminar este producto? Se ocultará del inventario pero se mantendrá en historiales.")){
                     setIsSubmitting(true);
                     try {
                       const res = await fetch(`/api/products/${productModal.id}`, { method: 'DELETE' });
                       if(res.ok) { setProductModal(null); showToast("Producto eliminado"); revalidateAll(); }
                       else showToast("Error al eliminar");
                     } finally { setIsSubmitting(false); }
                   }
                 }}>Eliminar Producto</button>
               )}
             </div>
          </form>
        </section>
      </div>
    )}
  </main>;
}
