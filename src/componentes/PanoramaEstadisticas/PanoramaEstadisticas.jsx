import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { fechaLocalISO } from '../../lib/finanzas'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function PanoramaOperativo() {
  const [loading, setLoading] = useState(true)
  const fechaActual = new Date()

  // Inicia por defecto en 'mes' y en el mes/año corriente
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes') 
  const [mesSeleccionado, setMesSeleccionado] = useState(fechaActual.getMonth() + 1)
  const [anioSeleccionado, setAnioSeleccionado] = useState(fechaActual.getFullYear())

  const [metricas, setMetricas] = useState({
    punitoriosCobrados: 0,    // Mora (punitorios) cobrada en el período
    capitalPrestado: 0,        // Total colocado en préstamos
    interesGenerado: 0,       // Interés REAL cobrado en el período
    totalCobrado: 0,          // Total recaudado (cuotas + punitorios)
    balancePendiente: 0       // Saldo pendiente total por cobrar
  })

  // Comparador robusto de fechas (YYYY-MM)
  const coincideMes = (fechaStr, anio, mes) => {
    if (!fechaStr) return false
    // Los timestamps vienen en UTC: se pasan a fecha local antes de comparar
    const match = fechaLocalISO(fechaStr).match(/^(\d{4})-(\d{2})/)
    if (!match) return false
    const y = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    return y === Number(anio) && m === Number(mes)
  }

  const cargarMetricas = async () => {
    setLoading(true)
    try {
      // 1. Préstamos
      const { data: prestamos, error: errP } = await supabase
        .from('prestamos')
        .select('id, created_at, fecha_inicio, monto_capital, monto_total_pagar, estado')

      if (errP) console.error('Error al cargar préstamos:', errP.message)

      // 2. Pagos (select * para que funcione antes y después de la migración del punitorio)
      const { data: pagos, error: errPagos } = await supabase
        .from('pagos')
        .select('*')

      if (errPagos) console.error('Error al cargar pagos:', errPagos.message)

      // Los préstamos cancelados (anulados) no cuentan en las métricas
      const todosLosPrestamos = (prestamos || []).filter((p) => p.estado !== 'cancelado')
      const idsPrestamosValidos = new Set(todosLosPrestamos.map((p) => p.id))
      const todosLosPagos = (pagos || []).filter((p) => idsPrestamosValidos.has(p.prestamo_id))

      // 💡 MAPA DE PRÉSTAMOS: Calcula el ratio de ganancia (interés / total) por cada préstamo
      const mapaPrestamos = {}
      todosLosPrestamos.forEach((p) => {
        const capital = Number(p.monto_capital || 0)
        const totalPagar = Number(p.monto_total_pagar || 0)
        const interesTotal = Math.max(0, totalPagar - capital)

        mapaPrestamos[p.id] = {
          ratioInteres: totalPagar > 0 ? (interesTotal / totalPagar) : 0,
          capital,
          totalPagar
        }
      })

      // Filtrado según período
      let prestamosFiltrados = todosLosPrestamos
      let pagosFiltrados = todosLosPagos

      if (filtroPeriodo === 'mes') {
        prestamosFiltrados = prestamosFiltrados.filter((p) =>
          coincideMes(p.fecha_inicio || p.created_at, anioSeleccionado, mesSeleccionado)
        )

        pagosFiltrados = pagosFiltrados.filter((p) =>
          coincideMes(p.fecha_pago || p.created_at, anioSeleccionado, mesSeleccionado)
        )
      }

      // --- CÁLCULOS FINANCIEROS REALES ---
      // A. Capital prestado en el período
      const capitalPrestado = prestamosFiltrados.reduce((acc, p) => acc + Number(p.monto_capital || 0), 0)

      // B. Punitorios y total cobrado en el período
      const punitoriosCobrados = pagosFiltrados.reduce((acc, p) => acc + Number(p.punitorio || 0), 0)
      const totalCobrado = pagosFiltrados.reduce((acc, p) => acc + Number(p.monto_cobrado || 0), 0) + punitoriosCobrados

      // C. Interés REAL generado (solo sobre lo efectivamente cobrado)
      const interesGeneradoReal = pagosFiltrados.reduce((acc, cobro) => {
        const prestamoRef = mapaPrestamos[cobro.prestamo_id]
        const ratio = prestamoRef ? prestamoRef.ratioInteres : 0
        return acc + (Number(cobro.monto_cobrado || 0) * ratio)
      }, 0)

      // D. Saldo pendiente de cobro en cartera (Total prestado a devolver - Total cobrado)
      const totalADevolverHistorico = todosLosPrestamos.reduce((acc, p) => acc + Number(p.monto_total_pagar || 0), 0)
      const totalCobradoHistorico = todosLosPagos.reduce((acc, p) => acc + Number(p.monto_cobrado || 0), 0)
      
      // En modo mes: lo que falta cobrar de los préstamos otorgados ese mes
      // (se restan todos los cobros de ESOS préstamos, no los cobros del mes
      // que pertenecen a otros préstamos). En histórico: la cartera global.
      const idsPrestamosPeriodo = new Set(prestamosFiltrados.map((p) => p.id))
      const totalADevolverPeriodo = prestamosFiltrados.reduce((acc, p) => acc + Number(p.monto_total_pagar || 0), 0)
      const cobradoDePrestamosPeriodo = todosLosPagos
        .filter((p) => idsPrestamosPeriodo.has(p.prestamo_id))
        .reduce((acc, p) => acc + Number(p.monto_cobrado || 0), 0)
      const balancePendiente = filtroPeriodo === 'mes'
        ? Math.max(0, totalADevolverPeriodo - cobradoDePrestamosPeriodo)
        : Math.max(0, totalADevolverHistorico - totalCobradoHistorico)

      setMetricas({
        punitoriosCobrados,
        capitalPrestado,
        interesGenerado: interesGeneradoReal,
        totalCobrado,
        balancePendiente
      })

    } catch (err) {
      console.error('Error al cargar métricas del panorama:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarMetricas()

    const canalRealtime = supabase
      .channel('schema-panorama-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestamos' }, () => cargarMetricas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => cargarMetricas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => cargarMetricas())
      .subscribe()

    return () => {
      supabase.removeChannel(canalRealtime)
    }
  }, [filtroPeriodo, mesSeleccionado, anioSeleccionado])

  return (
    <section className="w-[95%] mx-auto space-y-5 my-6 select-none">
      
      {/* Cabecera y Selector de Período */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
            PANORAMA OPERATIVO
          </h2>
        </div>

        {/* CONTROLES DE FILTRADO POR MES / AÑO */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white p-1 rounded-2xl border border-line shadow-xs">
            <button
              onClick={() => setFiltroPeriodo('historico')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filtroPeriodo === 'historico' ? 'bg-[#0d6b63] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setFiltroPeriodo('mes')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filtroPeriodo === 'mes' ? 'bg-[#0d6b63] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Mes
            </button>
          </div>

          {/* Desplegables visibles solo en modo 'mes' */}
          {filtroPeriodo === 'mes' && (
            <>
              <select
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                className="rounded-2xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
              >
                {MESES.map((m, idx) => (
                  <option key={idx} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                className="rounded-2xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
            </>
          )}

          <button
            onClick={cargarMetricas}
            disabled={loading}
            title="Recargar datos"
            className="flex items-center gap-2 p-2 rounded-2xl bg-white border border-line text-xs font-bold text-slate-600 hover:text-[#0d6b63] hover:border-[#0d6b63] transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0d6b63]' : ''}`} />
          </button>
        </div>
      </div>

      {/* GRILLA DE 5 TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">

        {/* 1. PUNITORIOS COBRADOS */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              PUNITORIOS COBRADOS
            </span>
            <div className="p-2 rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-red-700 tracking-tight break-words">
              ${metricas.punitoriosCobrados.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-medium text-slate-400 mt-1 block">
              {filtroPeriodo === 'mes' ? `Mora cobrada en ${MESES[mesSeleccionado - 1]}` : 'Mora cobrada histórica'}
            </span>
          </div>
        </div>

        {/* 2. CAPITAL PRESTADO / COLOCADO */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              CAPITAL PRESTADO
            </span>
            <div className="p-2 rounded-2xl bg-[#0d6b63]/10 text-[#0d6b63]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-[#0d6b63] tracking-tight break-words">
              ${metricas.capitalPrestado.toLocaleString('es-AR')}
            </p>
            <span className="text-[10px] font-medium text-slate-400 mt-1 block">
              {filtroPeriodo === 'mes' ? `Colocado en ${MESES[mesSeleccionado - 1]}` : 'Total histórico prestado'}
            </span>
          </div>
        </div>

        {/* 3. INTERÉS GENERADO (REAL COBRADO) */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              INTERÉS PERCIBIDO
            </span>
            <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700 tracking-tight break-words">
              +${metricas.interesGenerado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-medium text-emerald-600/80 mt-1 block">
              {filtroPeriodo === 'mes' ? `Ganancia real ${MESES[mesSeleccionado - 1]}` : 'Ganancia real acumulada'}
            </span>
          </div>
        </div>

        {/* 4. TOTAL COBRADO */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL COBRADO
            </span>
            <div className="p-2 rounded-2xl bg-blue-50 text-blue-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-blue-800 tracking-tight break-words">
              ${metricas.totalCobrado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-medium text-blue-600 mt-1 block">
              {filtroPeriodo === 'mes' ? `Cobros de ${MESES[mesSeleccionado - 1]}` : 'Recaudación total'}
            </span>
          </div>
        </div>

        {/* 5. BALANCE PENDIENTE */}
        <div className="col-span-2 lg:col-span-1 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              BALANCE PENDIENTE
            </span>
            <div className="p-2 rounded-2xl bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-bold text-amber-700 tracking-tight break-words">
              ${metricas.balancePendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-medium text-amber-600/80 mt-1 block">
              {filtroPeriodo === 'mes' ? `Por cobrar de ${MESES[mesSeleccionado - 1]}` : 'Por cobrar en cartera'}
            </span>
          </div>
        </div>

      </div>

    </section>
  )
}