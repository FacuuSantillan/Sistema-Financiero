import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Users,
  ChevronRight,
  Wallet
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function PanoramaOperativo({ 
  onAbrirDirectorioInversionistas,   
  rolUsuario = "admin"
}) {
  const [loading, setLoading] = useState(true)
  const fechaActual = new Date()

  // Inicia por defecto en 'mes' y en el mes/año corriente
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes') 
  const [mesSeleccionado, setMesSeleccionado] = useState(fechaActual.getMonth() + 1)
  const [anioSeleccionado, setAnioSeleccionado] = useState(fechaActual.getFullYear())

  const [metricas, setMetricas] = useState({
    capitalTotalInvertido: 0, // Fondo total disponible en billeteras de inversores
    capitalPrestado: 0,        // Total colocado en préstamos
    interesGenerado: 0,       // Interés REAL cobrado en el período
    totalCobrado: 0,          // Total recaudado
    balancePendiente: 0,      // Saldo pendiente total por cobrar
    inversoresActivos: 0
  })

  // Comparador robusto de fechas (YYYY-MM)
  const coincideMes = (fechaStr, anio, mes) => {
    if (!fechaStr) return false
    const match = String(fechaStr).match(/^(\d{4})-(\d{2})/)
    if (!match) return false
    const y = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    return y === Number(anio) && m === Number(mes)
  }

  const cargarMetricas = async () => {
    setLoading(true)
    try {
      // 1. Inversionistas ACTIVOS (Caja total)
      const { data: inversionistas, error: errInv } = await supabase
        .from('usuarios')
        .select('id, capital_disponible, activo, rol')
        .eq('activo', true)
        .eq('rol', 'inversionista')

      if (errInv) console.error('Error al cargar inversionistas:', errInv.message)
      const listaInversores = inversionistas || []

      const capitalTotalInvertido = listaInversores.reduce(
        (acc, inv) => acc + Number(inv.capital_disponible || 0), 0
      )
      const inversoresActivos = listaInversores.length

      // 2. Préstamos
      const { data: prestamos, error: errP } = await supabase
        .from('prestamos')
        .select('id, created_at, fecha_inicio, monto_capital, monto_total_pagar')

      if (errP) console.error('Error al cargar préstamos:', errP.message)

      // 3. Pagos
      const { data: pagos, error: errPagos } = await supabase
        .from('pagos')
        .select('prestamo_id, fecha_pago, created_at, monto_cobrado')

      if (errPagos) console.error('Error al cargar pagos:', errPagos.message)

      const todosLosPrestamos = prestamos || []
      const todosLosPagos = pagos || []

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

      // B. Total cobrado en el período
      const totalCobrado = pagosFiltrados.reduce((acc, p) => acc + Number(p.monto_cobrado || 0), 0)

      // C. Interés REAL generado (solo sobre lo efectivamente cobrado)
      const interesGeneradoReal = pagosFiltrados.reduce((acc, cobro) => {
        const prestamoRef = mapaPrestamos[cobro.prestamo_id]
        const ratio = prestamoRef ? prestamoRef.ratioInteres : 0
        return acc + (Number(cobro.monto_cobrado || 0) * ratio)
      }, 0)

      // D. Saldo pendiente de cobro en cartera (Total prestado a devolver - Total cobrado)
      const totalADevolverHistorico = todosLosPrestamos.reduce((acc, p) => acc + Number(p.monto_total_pagar || 0), 0)
      const totalCobradoHistorico = todosLosPagos.reduce((acc, p) => acc + Number(p.monto_cobrado || 0), 0)
      
      // En modo mes calcula lo pendiente de ese mes; en histórico, la cartera activa global
      const totalADevolverPeriodo = prestamosFiltrados.reduce((acc, p) => acc + Number(p.monto_total_pagar || 0), 0)
      const balancePendiente = filtroPeriodo === 'mes'
        ? Math.max(0, totalADevolverPeriodo - totalCobrado)
        : Math.max(0, totalADevolverHistorico - totalCobradoHistorico)

      setMetricas({
        capitalTotalInvertido,
        capitalPrestado,
        interesGenerado: interesGeneradoReal,
        totalCobrado,
        balancePendiente,
        inversoresActivos
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        {/* 1. CAPITAL TOTAL EN CAJA / INVERSIONISTAS */}
        <div className="p-5 rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              FONDO INVERSIONISTAS
            </span>
            <div className="p-2 rounded-2xl bg-purple-50 text-purple-700">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              ${metricas.capitalTotalInvertido.toLocaleString('es-AR')}
            </p>
            <span className="text-[10px] font-medium text-slate-400 mt-1 block">
              Capital total disponible
            </span>
          </div>
        </div>

        {/* 2. CAPITAL PRESTADO / COLOCADO */}
        <div className="p-5 rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              CAPITAL PRESTADO
            </span>
            <div className="p-2 rounded-2xl bg-[#0d6b63]/10 text-[#0d6b63]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#0d6b63] tracking-tight">
              ${metricas.capitalPrestado.toLocaleString('es-AR')}
            </p>
            <span className="text-[10px] font-medium text-slate-400 mt-1 block">
              {filtroPeriodo === 'mes' ? `Colocado en ${MESES[mesSeleccionado - 1]}` : 'Total histórico prestado'}
            </span>
          </div>
        </div>

        {/* 3. INTERÉS GENERADO (REAL COBRADO) */}
        <div className="p-5 rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              INTERÉS PERCIBIDO
            </span>
            <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-700 tracking-tight">
              +${metricas.interesGenerado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-medium text-emerald-600/80 mt-1 block">
              {filtroPeriodo === 'mes' ? `Ganancia real ${MESES[mesSeleccionado - 1]}` : 'Ganancia real acumulada'}
            </span>
          </div>
        </div>

        {/* 4. TOTAL COBRADO */}
        <div className="p-5 rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL COBRADO
            </span>
            <div className="p-2 rounded-2xl bg-blue-50 text-blue-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-800 tracking-tight">
              ${metricas.totalCobrado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-medium text-blue-600 mt-1 block">
              {filtroPeriodo === 'mes' ? `Cobros de ${MESES[mesSeleccionado - 1]}` : 'Recaudación total'}
            </span>
          </div>
        </div>

        {/* 5. BALANCE PENDIENTE */}
        <div className="p-5 rounded-3xl bg-white border border-line shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              BALANCE PENDIENTE
            </span>
            <div className="p-2 rounded-2xl bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-700 tracking-tight">
              ${metricas.balancePendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] font-medium text-amber-600/80 mt-1 block">
              {filtroPeriodo === 'mes' ? `Por cobrar de ${MESES[mesSeleccionado - 1]}` : 'Por cobrar en cartera'}
            </span>
          </div>
        </div>

      </div>

      {/* FILA SECUNDARIA: Inversores Activos Habilitados */}
      <div className="pt-1">
        <div 
          onClick={onAbrirDirectorioInversionistas}
          className="p-5 rounded-3xl bg-white border border-line shadow-xs hover:border-[#0d6b63] hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-[#0d6b63]/10 text-[#0d6b63] group-hover:bg-[#0d6b63] group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                INVERSORES ACTIVOS Y HABILITADOS
              </span>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">
                {metricas.inversoresActivos} {metricas.inversoresActivos === 1 ? 'Inversor habilitado' : 'Inversores habilitados'}
              </p>
              <span className="text-xs text-slate-400 block mt-0.5">
                Hacé clic para gestionar perfiles, fondos y deshabilitaciones
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-[#0d6b63] bg-[#0d6b63]/5 px-4 py-2 rounded-2xl group-hover:bg-[#0d6b63] group-hover:text-white transition-all">
            <span>Ver Inversores</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

    </section>
  )
}