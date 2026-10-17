import React, { useState, useEffect } from 'react'
import { 
  X, User, Briefcase, CheckCircle2, Clock, Calendar, 
  DollarSign, Receipt, PlusCircle, AlertCircle, ArrowRight, CornerDownRight 
} from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalFichaPrestamo({ isOpen, onClose, prestamo, usuarioLogueado = null, onCobroRegistrado }) {
  const [pagos, setPagos] = useState([])
  const [cliente, setCliente] = useState(null)
  const [inversionista, setInversionista] = useState(null)
  const [loading, setLoading] = useState(false)

  // Estados del sub-formulario de cobro directo
  const [mostrarFormCobro, setMostrarFormCobro] = useState(false)
  const [cuotaDestinoCobro, setCuotaDestinoCobro] = useState(null)
  const [guardandoCobro, setGuardandoCobro] = useState(false)
  const [errorCobro, setErrorCobro] = useState('')
  const [cobroData, setCobroData] = useState({
    monto_cobrado: '',
    metodo_pago: 'efectivo',
    fecha_pago: new Date().toISOString().split('T')[0],
    observaciones: ''
  })

  const cargarDetallesPrestamo = async () => {
    if (!prestamo) return
    setLoading(true)
    try {
      // 1. Cargar Pagos registrados
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
      console.error('Error al cargar ficha del préstamo:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && prestamo) {
      cargarDetallesPrestamo()
      setMostrarFormCobro(false)
      setErrorCobro('')
    }
  }, [isOpen, prestamo])

  if (!isOpen || !prestamo) return null

  // --- CÁLCULOS GENERALES ---
  const capital = Number(prestamo.monto_capital || prestamo.monto || 0)
  const totalPagar = Number(prestamo.monto_total_pagar || prestamo.monto_total || 0)
  const totalCobrado = pagos.reduce((acc, p) => acc + Number(p.monto_cobrado || p.monto_pago || 0), 0)
  const saldoRestante = Math.max(0, totalPagar - totalCobrado)
  const porcentajeCobrado = totalPagar > 0 ? Math.min(100, Math.round((totalCobrado / totalPagar) * 100)) : 0

  const cantidadCuotas = Number(prestamo.cantidad_cuotas || 1)
  const valorCuotaCalculado = Number(prestamo.monto_cuota || (totalPagar / cantidadCuotas) || 0)

  // Función para calcular la fecha teórica de vencimiento
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
      fecha.setMonth(fecha.getMonth() + (numeroCuota - 1))
    }
    return fecha
  }

  // --- DESGLOSE CON DISTRIBUCIÓN DE PAGOS TOTALES Y PARCIALES ---
  let acumuladorCobrado = totalCobrado
  const fechaBase = prestamo.fecha_inicio || prestamo.created_at
  const tablaCuotas = []

  for (let i = 1; i <= cantidadCuotas; i++) {
    const fechaVencimiento = calcularFechaVencimiento(fechaBase, i, prestamo.frecuencia)
    
    let estadoCuota = 'pendiente' // 'total' | 'parcial' | 'pendiente'
    let cubiertoEnEstaCuota = 0
    let restanteDeEstaCuota = valorCuotaCalculado

    if (acumuladorCobrado >= valorCuotaCalculado) {
      estadoCuota = 'total'
      cubiertoEnEstaCuota = valorCuotaCalculado
      restanteDeEstaCuota = 0
      acumuladorCobrado -= valorCuotaCalculado
    } else if (acumuladorCobrado > 0) {
      estadoCuota = 'parcial'
      cubiertoEnEstaCuota = acumuladorCobrado
      restanteDeEstaCuota = Math.max(0, valorCuotaCalculado - acumuladorCobrado)
      acumuladorCobrado = 0
    }

    tablaCuotas.push({
      numeroCuota: i,
      monto: valorCuotaCalculado,
      fechaVencimiento,
      estadoCuota,
      cubiertoEnEstaCuota,
      restanteDeEstaCuota
    })
  }

  // Abrir formulario de cobro para una cuota específica o general
  const handleAbrirCobro = (cuota = null) => {
    setCuotaDestinoCobro(cuota)
    const montoSugerido = cuota 
      ? (cuota.estadoCuota === 'parcial' ? cuota.restanteDeEstaCuota : cuota.monto)
      : Math.min(valorCuotaCalculado, saldoRestante)

    setCobroData({
      monto_cobrado: montoSugerido > 0 ? String(Math.round(montoSugerido)) : '',
      metodo_pago: 'efectivo',
      fecha_pago: new Date().toISOString().split('T')[0],
      observaciones: cuota ? `Pago Cuota #${cuota.numeroCuota}` : ''
    })
    setErrorCobro('')
    setMostrarFormCobro(true)
  }

  // Guardar el Cobro en Supabase
  const handleRegistrarCobro = async (e) => {
    e.preventDefault()
    setGuardandoCobro(true)
    setErrorCobro('')

    const montoNum = parseFloat(cobroData.monto_cobrado)
    if (!montoNum || montoNum <= 0) {
      setErrorCobro('Ingresá un monto de cobro válido.')
      setGuardandoCobro(false)
      return
    }

    try {
      const payloadPago = {
        prestamo_id: prestamo.id,
        cliente_id: prestamo.cliente_id,
        inversionista_id: prestamo.inversionista_id || null,
        monto_cobrado: montoNum,
        metodo_pago: cobroData.metodo_pago,
        fecha_pago: new Date(cobroData.fecha_pago).toISOString(),
        observaciones: cobroData.observaciones?.trim() || null,
        creado_por: usuarioLogueado?.id || null
      }

      const { error: errInsert } = await supabase
        .from('pagos')
        .insert([payloadPago])

      if (errInsert) throw errInsert

      // Si con este cobro se completa el saldo total, marcar préstamo como finalizado
      const nuevoTotalCobrado = totalCobrado + montoNum
      if (nuevoTotalCobrado >= totalPagar && prestamo.estado !== 'finalizado') {
        await supabase
          .from('prestamos')
          .update({ estado: 'finalizado' })
          .eq('id', prestamo.id)
      }

      // Registro en auditoría
      await supabase
        .from('auditoria_actividades')
        .insert([{
          tipo: 'COBRO',
          accion: 'CREADO',
          titulo: `Cobro $${montoNum.toLocaleString('es-AR')}`,
          subtitulo: `Préstamo #${prestamo.id?.toString().substring(0, 8)}`,
          detalles: `Método: ${cobroData.metodo_pago.toUpperCase()} · Cliente: ${cliente?.nombre_completo || 'Cliente'}`,
          persona: cliente?.nombre_completo || 'Cliente',
          autor_id: usuarioLogueado?.id || null,
          autor_nombre: usuarioLogueado?.nombre_completo || 'Administración',
          autor_rol: usuarioLogueado?.rol || 'admin',
          estado: 'Cobro Registrado'
        }])

      setMostrarFormCobro(false)
      await cargarDetallesPrestamo()
      if (onCobroRegistrado) onCobroRegistrado()
    } catch (err) {
      console.error('Error al registrar cobro:', err)
      setErrorCobro(err.message || 'Error al procesar el cobro.')
    } finally {
      setGuardandoCobro(false)
    }
  }

  const formatearFechaSimple = (fechaObj) => {
    if (!fechaObj) return ''
    const d = new Date(fechaObj)
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const año = d.getFullYear()
    return `${dia}/${mes}/${año}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-4xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line h-[92vh] flex flex-col overflow-hidden">
        
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

          <div className="flex items-center gap-2">
       

            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto space-y-5 pt-4 pr-1">

          {/* PERFILES: CLIENTE E INVERSIONISTA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* FORMULARIO DE COBRO RÁPIDO */}
          {mostrarFormCobro && (
            <div className="p-5 rounded-3xl bg-white border-2 border-[#0d6b63] shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#0d6b63]" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {cuotaDestinoCobro 
                      ? `Registrar cobro para Cuota #${cuotaDestinoCobro.numeroCuota}` 
                      : 'Registrar nuevo cobro'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarFormCobro(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRegistrarCobro} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Monto a Cobrar ($)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={saldoRestante}
                      required
                      value={cobroData.monto_cobrado}
                      onChange={(e) => setCobroData((prev) => ({ ...prev, monto_cobrado: e.target.value }))}
                      placeholder="Ej. 25000"
                      className="w-full px-3.5 py-2 rounded-xl border border-line text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0d6b63]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Método de Pago
                    </label>
                    <select
                      value={cobroData.metodo_pago}
                      onChange={(e) => setCobroData((prev) => ({ ...prev, metodo_pago: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-xl border border-line text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-[#0d6b63] cursor-pointer"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="debito">Débito</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Fecha del Cobro
                    </label>
                    <input
                      type="date"
                      required
                      value={cobroData.fecha_pago}
                      onChange={(e) => setCobroData((prev) => ({ ...prev, fecha_pago: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-xl border border-line text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0d6b63]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observaciones / Comprobante (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cobroData.observaciones}
                    onChange={(e) => setCobroData((prev) => ({ ...prev, observaciones: e.target.value }))}
                    placeholder="Ej. Transferencia Nro 048291..."
                    className="w-full px-3.5 py-2 rounded-xl border border-line text-xs text-slate-800 focus:outline-none focus:border-[#0d6b63]"
                  />
                </div>

                {errorCobro && (
                  <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-200">
                    ⚠️ {errorCobro}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMostrarFormCobro(false)}
                    className="px-4 py-2 rounded-xl border border-line bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoCobro}
                    className="px-5 py-2 rounded-xl bg-[#0d6b63] text-white text-xs font-bold shadow-xs hover:bg-[#0b5a52] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {guardandoCobro ? 'Guardando...' : 'Confirmar Cobro'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* CRONOGRAMA DE CUOTAS (TOTALES, PARCIALES Y PENDIENTES) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0d6b63]" />
                Cronograma de Cuotas ({cantidadCuotas})
              </h4>
              <span className="text-xs font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-line">
                Cobrado: ${totalCobrado.toLocaleString('es-AR')} de${totalPagar.toLocaleString('es-AR')}
              </span>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-white rounded-2xl border border-line">
                Cargando estado de las cuotas...
              </p>
            ) : (
              <div className="space-y-2">
                {tablaCuotas.map((cuota) => {
                  const esTotal = cuota.estadoCuota === 'total'
                  const esParcial = cuota.estadoCuota === 'parcial'
                  const esPendiente = cuota.estadoCuota === 'pendiente'

                  return (
                    <div 
                      key={cuota.numeroCuota}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        esTotal 
                          ? 'bg-emerald-50/50 border-emerald-200' 
                          : esParcial
                          ? 'bg-blue-50/50 border-blue-200'
                          : 'bg-white border-line'
                      }`}
                    >
                      {/* Información de la cuota */}
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          esTotal 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : esParcial 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          #{cuota.numeroCuota}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              Cuota #{cuota.numeroCuota} — ${Math.round(cuota.monto).toLocaleString('es-AR')}
                            </span>

                            {/* Badge de estado */}
                            {esTotal && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                PAGO TOTAL
                              </span>
                            )}

                            {esParcial && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                PAGO PARCIAL
                              </span>
                            )}

                            {esPendiente && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                PENDIENTE
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 font-medium mt-0.5 space-x-2">
                            <span>Vencimiento: {formatearFechaSimple(cuota.fechaVencimiento)}</span>
                            {esParcial && (
                              <span className="text-blue-700 font-bold">
                                · Abonado: ${Math.round(cuota.cubiertoEnEstaCuota).toLocaleString('es-AR')} (Resta:${Math.round(cuota.restanteDeEstaCuota).toLocaleString('es-AR')})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botón de cobro directo o confirmación */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {esTotal ? (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100/60 px-3 py-1.5 rounded-xl border border-emerald-200/80">
                            ✓ Cuota Completa
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAbrirCobro(cuota)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              esParcial
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                                : 'bg-[#0d6b63] hover:bg-[#0b5a52] text-white shadow-2xs'
                            }`}
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{esParcial ? 'Completar cuota' : 'Cobrar cuota'}</span>
                          </button>
                        )}
                      </div>

                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* HISTORIAL COMPLETO DE TRANSACCIONES / PAGOS */}
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#0d6b63]" />
              Historial de Cobros Recibidos ({pagos.length})
            </h4>

            {pagos.length === 0 ? (
              <p className="text-xs text-slate-400 bg-white p-4 rounded-2xl border border-line">
                No hay pagos asentados para este préstamo.
              </p>
            ) : (
              <div className="space-y-1.5">
                {pagos.map((p) => (
                  <div key={p.id} className="p-3 bg-white rounded-2xl border border-line flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">
                        ${Number(p.monto_cobrado || p.monto_pago || 0).toLocaleString('es-AR')}
                      </span>
                      <span className="text-slate-500 font-medium ml-2">
                        ({(p.metodo_pago || 'efectivo').toUpperCase()}) {p.observaciones ? `· ${p.observaciones}` : ''}
                      </span>
                    </div>
                    <span className="text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-lg">
                      {formatearFechaSimple(p.fecha_pago || p.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}