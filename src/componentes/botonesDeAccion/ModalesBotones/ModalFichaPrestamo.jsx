import React, { useState, useEffect } from 'react'
import { X, User, Briefcase, CheckCircle2, Clock, Calendar, DollarSign, Receipt, AlertCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalFichaPrestamo({ isOpen, onClose, prestamo }) {
  const [pagos, setPagos] = useState([])
  const [cliente, setCliente] = useState(null)
  const [inversionista, setInversionista] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !prestamo) return

    async function cargarDetallesPrestamo() {
      setLoading(true)
      try {
        // 1. Cargar Pagos registrados para este préstamo
        const { data: pagosData, error: errPagos } = await supabase
          .from('pagos')
          .select('*')
          .eq('prestamo_id', prestamo.id)
          .order('fecha_pago', { ascending: true })

        if (errPagos) console.warn('Error al cargar pagos:', errPagos.message)
        setPagos(pagosData || [])

        // 2. Cargar Datos del Cliente
        if (prestamo.cliente_id) {
          const { data: cliData } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', prestamo.cliente_id)
            .maybeSingle()
          setCliente(cliData)
        }

        // 3. Cargar Datos del Inversionista
        if (prestamo.inversionista_id) {
          const { data: invData } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', prestamo.inversionista_id)
            .maybeSingle()
          setInversionista(invData)
        } else {
          setInversionista(null)
        }
      } catch (err) {
        console.error('Error al cargar la ficha del préstamo:', err)
      } finally {
        setLoading(false)
      }
    }

    cargarDetallesPrestamo()
  }, [isOpen, prestamo])

  if (!isOpen || !prestamo) return null

  // --- CÁLCULOS FINANCIEROS Y DE CUOTAS ---
  const capital = Number(prestamo.monto_capital || prestamo.monto || 0)
  const totalPagar = Number(prestamo.monto_total_pagar || prestamo.monto_total || 0)
  const totalCobrado = pagos.reduce((acc, p) => acc + Number(p.monto_cobrado || p.monto_pago || 0), 0)
  const saldoRestante = Math.max(0, totalPagar - totalCobrado)
  const porcentajeCobrado = totalPagar > 0 ? Math.min(100, Math.round((totalCobrado / totalPagar) * 100)) : 0

  const cantidadCuotas = Number(prestamo.cantidad_cuotas || 1)
  const valorCuotaCalculado = Number(prestamo.monto_cuota || (totalPagar / cantidadCuotas) || 0)
  const cuotasPagasCount = Math.min(cantidadCuotas, Math.floor(totalCobrado / (valorCuotaCalculado || 1)))

  // Función para calcular la fecha teórica de vencimiento de cada cuota
  const calcularFechaVencimiento = (fechaInicioStr, numeroCuota, frecuencia) => {
    if (!fechaInicioStr) return new Date()
    const fecha = new Date(fechaInicioStr)
    const freq = (frecuencia || 'mensual').toLowerCase()

    if (freq.includes('diari')) {
      fecha.setDate(fecha.getDate() + (numeroCuota - 1))
    } else if (freq.includes('seman')) {
      fecha.setDate(fecha.getDate() + (numeroCuota - 1) * 7)
    } else if (freq.includes('quincen')) {
      fecha.setDate(fecha.getDate() + (numeroCuota - 1) * 15)
    } else {
      // Mensual por defecto
      fecha.setMonth(fecha.getMonth() + (numeroCuota - 1))
    }
    return fecha
  }

  // Generación del Desglose de Cuotas
  const fechaBase = prestamo.fecha_inicio || prestamo.created_at
  const tablaCuotas = []

  for (let i = 1; i <= cantidadCuotas; i++) {
    const fechaVencimiento = calcularFechaVencimiento(fechaBase, i, prestamo.frecuencia)
    
    // Asignar el pago correspondiente a esta cuota si existe en el historial
    const pagoAsociado = pagos[i - 1] || null
    const esCuotaCobrada = i <= cuotasPagasCount || (pagoAsociado !== null)

    tablaCuotas.push({
      numeroCuota: i,
      monto: valorCuotaCalculado,
      fechaVencimiento: fechaVencimiento,
      estaCobrada: esCuotaCobrada,
      pagoInfo: pagoAsociado
    })
  }

  // Formatear fechas
  const formatearFechaSimple = (fechaObj) => {
    if (!fechaObj) return ''
    const d = new Date(fechaObj)
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const año = d.getFullYear()
    return `${dia}/${mes}/${año}`
  }

  const formatearFechaHora = (fechaRaw) => {
    if (!fechaRaw) return ''
    const d = new Date(fechaRaw)
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const año = d.getFullYear()
    const horas = String(d.getHours()).padStart(2, '0')
    const minutos = String(d.getMinutes()).padStart(2, '0')
    return `${dia}/${mes}/${año} a las ${horas}:${minutos} hs`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line h-[90vh] flex flex-col overflow-hidden">
        
        {/* ENCABEZADO */}
        <div className="flex items-center justify-between pb-4 border-b border-line shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">
                FICHA TÉCNICA DE PRÉSTAMO
              </span>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                prestamo.estado === 'finalizado' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {prestamo.estado === 'finalizado' ? 'FINALIZADO' : prestamo.estado || 'ACTIVO'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
              Préstamo #{prestamo.id?.toString().substring(0, 8) || '001'}
            </h2>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto space-y-5 pt-4 pr-1">

          {/* PERFILES: CLIENTE E INVERSIONISTA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="p-4 rounded-2xl bg-white border border-line flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63]">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">CLIENTE ASIGNADO</span>
                <h4 className="font-bold text-slate-900 text-sm">
                  {cliente?.nombre_completo || prestamo.clientes?.nombre_completo || 'Cliente'}
                </h4>
                <span className="text-xs text-slate-500 font-medium">
                  Tel: {cliente?.telefono || 'Sin teléfono'}
                </span>
              </div>
            </div>

            {/* Inversionista */}
            <div className="p-4 rounded-2xl bg-white border border-line flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63]">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">FONDEADOR / INVERSIONISTA</span>
                <h4 className="font-bold text-slate-900 text-sm">
                  {inversionista ? (inversionista.nombre_completo || inversionista.nombre) : 'Propio (Administrador)'}
                </h4>
                <span className="text-xs text-slate-500 font-medium">Origen de Capital</span>
              </div>
            </div>
          </div>

          {/* RESUMEN FINANCIERO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-line">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">CAPITAL ENTREGADO</span>
              <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                ${capital.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-line">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">INTERÉS APLICADO</span>
              <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1">
                +${Math.max(0, totalPagar - capital).toLocaleString('es-AR')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-line">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">TOTAL COBRADO</span>
              <p className="text-lg sm:text-xl font-bold text-blue-800 mt-1">
                ${totalCobrado.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-line">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">SALDO RESTANTE</span>
              <p className="text-lg sm:text-xl font-bold text-amber-700 mt-1">
                ${saldoRestante.toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          {/* BARRA DE PROGRESO */}
          <div className="p-4 rounded-2xl bg-white border border-line space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>PROGRESO DE CANCELACIÓN</span>
              <span className="text-[#0d6b63]">{porcentajeCobrado}% Recaudado</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#0d6b63] transition-all duration-500 rounded-full"
                style={{ width: `${porcentajeCobrado}%` }}
              />
            </div>
          </div>

          {/* 🔴 NUEVA SECCIÓN: DESGLOSE DE CUOTAS (COBRADAS Y POR COBRAR) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0d6b63]" />
                Cronograma y Desglose de Cuotas ({cantidadCuotas})
              </h4>
              <span className="text-xs font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-line">
                {cuotasPagasCount} de {cantidadCuotas} cuotas pagadas
              </span>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-white rounded-2xl border border-line">
                Cargando historial de cuotas...
              </p>
            ) : (
              <div className="space-y-2">
                {tablaCuotas.map((cuota) => {
                  const estaCobrada = cuota.estaCobrada
                  const fechaCobroReal = cuota.pagoInfo?.fecha_pago || cuota.pagoInfo?.created_at
                  const metodo = cuota.pagoInfo?.metodo_pago || 'efectivo'

                  return (
                    <div 
                      key={cuota.numeroCuota}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        estaCobrada 
                          ? 'bg-emerald-50/50 border-emerald-200/80' 
                          : 'bg-white border-line'
                      }`}
                    >
                      {/* Número y Monto de la Cuota */}
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          estaCobrada ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          #{cuota.numeroCuota}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              Cuota #{cuota.numeroCuota} — ${cuota.monto.toLocaleString('es-AR')}
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              estaCobrada 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {estaCobrada ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              <span>{estaCobrada ? 'COBRADA' : 'PENDIENTE DE COBRO'}</span>
                            </span>
                          </div>

                          {/* Fecha Teórica de Vencimiento */}
                          <span className="text-xs text-slate-500 font-medium block mt-0.5">
                            Vencimiento programado: {formatearFechaSimple(cuota.fechaVencimiento)}
                          </span>
                        </div>
                      </div>

                      {/* Detalles del Cobro (Fecha, Hora y Método) */}
                      <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                        {estaCobrada ? (
                          <div>
                            <span className="text-xs font-bold text-emerald-800 block">
                              ✓ Cobrada el {formatearFechaHora(fechaCobroReal)}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Método: {metodo.toUpperCase()} {cuota.pagoInfo?.observaciones ? `· ${cuota.pagoInfo.observaciones}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 inline-block">
                            Pendiente de pago
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}