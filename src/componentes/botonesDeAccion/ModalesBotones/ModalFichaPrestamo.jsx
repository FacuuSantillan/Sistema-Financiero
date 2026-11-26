import React, { useState, useEffect } from 'react'
import {
  X, User, CheckCircle2, Clock, Calendar,
  DollarSign, Receipt, AlertCircle, Pencil, Trash2, AlertTriangle
} from 'lucide-react'
import ModalEditarPrestamo from '../../comunes/ModalEditarPrestamo'
import { supabase } from '../../../lib/supabaseClient'
import {
  hoyLocalISO, fechaFormularioATimestamp, cronogramaConVencimientos,
  redondear2, TOLERANCIA_SALDO, configPunitorioPrestamo, periodosCobradosPorCuota,
  punitorioPendiente, detallePunitorioParaGuardar
} from '../../../lib/finanzas'
import { usePunitorioGeneral } from '../../../lib/usePunitorioGeneral'
import BotonWhatsApp from '../../comunes/BotonWhatsApp'
import CalculadoraPunitorio from '../../comunes/CalculadoraPunitorio'
import PunitorioPrestamo from '../../comunes/PunitorioPrestamo'
import { avisar } from '../../../lib/avisos'
import { abrirWhatsApp, mensajeComprobante, normalizarTelefonoAR } from '../../../lib/whatsapp'

const formatearMonto = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })

export default function ModalFichaPrestamo({ isOpen, onClose, prestamo: prestamoProp, usuarioLogueado = null, onCobroRegistrado, onPrestamoEliminado }) {
  // Edición y borrado del préstamo (solo owner/admin)
  const puedeAdministrar = usuarioLogueado?.rol === 'owner' || usuarioLogueado?.rol === 'admin'
  const [editandoPrestamo, setEditandoPrestamo] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState('')

  const [pagos, setPagos] = useState([])
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(false)
  // Versión del préstamo leída de la base (refleja cambios hechos en esta ficha)
  const [prestamoDB, setPrestamoDB] = useState(null)
  const prestamo = prestamoProp && prestamoDB?.id === prestamoProp.id ? { ...prestamoProp, ...prestamoDB } : prestamoProp
  const { config: punitorioGeneral } = usePunitorioGeneral(isOpen)

  // Estados del sub-formulario de cobro directo
  const [mostrarFormCobro, setMostrarFormCobro] = useState(false)
  const [cuotaDestinoCobro, setCuotaDestinoCobro] = useState(null)
  const [guardandoCobro, setGuardandoCobro] = useState(false)
  const [errorCobro, setErrorCobro] = useState('')
  const [cobroData, setCobroData] = useState({
    monto_cobrado: '',
    metodo_pago: 'efectivo',
    fecha_pago: hoyLocalISO(),
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

      // Datos actualizados del préstamo (estado y configuración de punitorio)
      const { data: prestamoFresco } = await supabase
        .from('prestamos')
        .select('*')
        .eq('id', prestamo.id)
        .maybeSingle()
      setPrestamoDB(prestamoFresco || null)

      // 2. Cargar Datos del Cliente
      if (prestamo.cliente_id) {
        const { data: cliData } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', prestamo.cliente_id)
          .maybeSingle()
        setCliente(cliData)
      }
    } catch (err) {
      console.error('Error al cargar ficha del préstamo:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && prestamoProp) {
      setPrestamoDB(null)
      cargarDetallesPrestamo()
      setMostrarFormCobro(false)
      setErrorCobro('')
    }
  }, [isOpen, prestamoProp])

  if (!isOpen || !prestamo) return null

  // --- CÁLCULOS GENERALES ---
  const capital = Number(prestamo.monto_capital || prestamo.monto || 0)
  const totalPagar = Number(prestamo.monto_total_pagar || prestamo.monto_total || 0)
  const totalCobrado = pagos.reduce((acc, p) => acc + Number(p.monto_cobrado || p.monto_pago || 0), 0)
  const saldoRestante = Math.max(0, redondear2(totalPagar - totalCobrado))
  const porcentajeCobrado = totalPagar > 0 ? Math.min(100, Math.round((totalCobrado / totalPagar) * 100)) : 0

  const cantidadCuotas = Number(prestamo.cantidad_cuotas || 1)
  const valorCuotaCalculado = Number(prestamo.monto_cuota || (totalPagar / cantidadCuotas) || 0)

  // --- DESGLOSE CON DISTRIBUCIÓN DE PAGOS TOTALES Y PARCIALES (en centavos) ---
  const { cuotas: cronograma } = cronogramaConVencimientos(
    { ...prestamo, monto_total_pagar: totalPagar, cantidad_cuotas: cantidadCuotas, monto_cuota: valorCuotaCalculado },
    totalCobrado
  )
  const tablaCuotas = cronograma.map((c) => ({
    ...c,
    estadoCuota: c.estado,
    cubiertoEnEstaCuota: c.cubierto,
    restanteDeEstaCuota: c.restante
  }))

  const prestamoCancelado = totalPagar > 0 && saldoRestante <= TOLERANCIA_SALDO
  const estadoMostrado = prestamoCancelado ? 'finalizado' : prestamo.estado
  const cuotasVencidas = prestamoCancelado ? [] : tablaCuotas.filter((c) => c.vencida)

  // --- PUNITORIO OBLIGATORIO (según la configuración del préstamo o la general) ---
  const configPunitorio = configPunitorioPrestamo(prestamo, punitorioGeneral)
  const periodosCobrados = periodosCobradosPorCuota(pagos)

  // Cuotas vencidas sobre las que se calcula el punitorio del cobro en curso
  const vencidasDelCobro = cuotaDestinoCobro
    ? cuotasVencidas.filter((c) => c.numeroCuota === cuotaDestinoCobro.numeroCuota)
    : cuotasVencidas
  const pendienteCobro = punitorioPendiente(vencidasDelCobro, configPunitorio, periodosCobrados)
  const punitorioCobro = pendienteCobro.total
  const punitorioTotalPrestamo = punitorioPendiente(cuotasVencidas, configPunitorio, periodosCobrados).total

  const nombreCliente = cliente?.nombre_completo || prestamo.clientes?.nombre_completo || 'Cliente'
  const datosWhatsApp = (cuota) => ({
    nombre: nombreCliente,
    telefono: cliente?.telefono,
    numeroCuota: cuota.numeroCuota,
    cantidadCuotas,
    monto: cuota.restante,
    vencimiento: cuota.fechaVencimiento,
    diasAtraso: cuota.diasAtraso,
    punitorio: punitorioPendiente([cuota], configPunitorio, periodosCobrados).total
  })

  // Abrir formulario de cobro para una cuota específica o general
  const handleAbrirCobro = (cuota = null) => {
    setCuotaDestinoCobro(cuota)
    const montoSugerido = cuota
      ? Math.min(cuota.restanteDeEstaCuota, saldoRestante)
      : Math.min(valorCuotaCalculado, saldoRestante)

    setCobroData({
      monto_cobrado: montoSugerido > 0 ? redondear2(montoSugerido).toFixed(2) : '',
      metodo_pago: 'efectivo',
      fecha_pago: hoyLocalISO(),
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

    const montoNum = redondear2(parseFloat(cobroData.monto_cobrado))
    if (!(montoNum > 0)) {
      setErrorCobro('Ingresá un monto de cobro válido.')
      setGuardandoCobro(false)
      return
    }

    if (montoNum > saldoRestante + 0.009) {
      setErrorCobro(`El monto supera el saldo pendiente ($${saldoRestante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}).`)
      setGuardandoCobro(false)
      return
    }

    try {
      let autorId = usuarioLogueado?.id || null
      if (!autorId) {
        const { data: authData } = await supabase.auth.getUser()
        autorId = authData?.user?.id || null
      }

      const payloadPago = {
        prestamo_id: prestamo.id,
        cliente_id: prestamo.cliente_id,
        inversionista_id: prestamo.inversionista_id || null,
        monto_cobrado: montoNum,
        metodo_pago: cobroData.metodo_pago,
        fecha_pago: fechaFormularioATimestamp(cobroData.fecha_pago),
        observaciones: cobroData.observaciones?.trim() || null,
        creado_por: autorId
      }

      // El punitorio se guarda aparte: no descuenta saldo de las cuotas
      if (punitorioCobro > 0) {
        payloadPago.punitorio = punitorioCobro
        payloadPago.punitorio_detalle = detallePunitorioParaGuardar(configPunitorio, pendienteCobro)
      }

      const { data: pagoCreado, error: errInsert } = await supabase
        .from('pagos')
        .insert([payloadPago])
        .select()
        .single()

      if (errInsert) throw errInsert

      // Si con este cobro se completa el saldo total, marcar préstamo como finalizado
      // (se recalcula desde la base para no depender de datos desactualizados)
      const { data: todosLosPagos, error: errSum } = await supabase
        .from('pagos')
        .select('monto_cobrado')
        .eq('prestamo_id', prestamo.id)

      if (errSum) throw errSum

      const totalAcumuladoDB = (todosLosPagos || []).reduce((acc, p) => acc + Number(p.monto_cobrado || 0), 0)
      if (totalAcumuladoDB >= totalPagar - TOLERANCIA_SALDO && prestamo.estado !== 'finalizado') {
        const { error: errEstado } = await supabase
          .from('prestamos')
          .update({ estado: 'finalizado' })
          .eq('id', prestamo.id)

        if (errEstado) throw errEstado
      }

      // Registro en auditoría
      const { error: errAudit } = await supabase
        .from('auditoria_actividades')
        .insert([{
          tipo: 'COBRO',
          accion: 'COBRO',
          titulo: `Ingreso $${(montoNum + punitorioCobro).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
          subtitulo: `Cobro a ${nombreCliente}`,
          detalles: `Método: ${cobroData.metodo_pago}${punitorioCobro > 0 ? ` · Cuota: $${montoNum.toLocaleString('es-AR', { minimumFractionDigits: 2 })} + Punitorio: $${punitorioCobro.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''}${cobroData.observaciones?.trim() ? ` · ${cobroData.observaciones.trim()}` : ''}`,
          persona: nombreCliente,
          autor_id: autorId,
          autor_nombre: usuarioLogueado?.nombre || 'Administración',
          autor_rol: usuarioLogueado?.rol || 'admin',
          estado: 'Registrado',
          metadata: {
            ...(pagoCreado || payloadPago),
            clientes: { nombre_completo: nombreCliente }
          }
        }])

      if (errAudit) console.warn('Aviso al registrar auditoría de cobro:', errAudit.message)

      setMostrarFormCobro(false)
      await cargarDetallesPrestamo()

      // Aviso con opción de mandar el comprobante por WhatsApp
      const telefono = cliente?.telefono
      const comprobante = mensajeComprobante({
        nombre: nombreCliente,
        monto: montoNum,
        punitorio: punitorioCobro,
        metodo: cobroData.metodo_pago,
        fecha: new Date(`${cobroData.fecha_pago}T12:00:00`),
        saldoRestante: Math.max(0, totalPagar - totalAcumuladoDB),
        prestamoId: prestamo.id
      })
      avisar(
        `Cobro de $${(montoNum + punitorioCobro).toLocaleString('es-AR', { minimumFractionDigits: 2 })} registrado`,
        'exito',
        normalizarTelefonoAR(telefono)
          ? { accion: { texto: 'Enviar comprobante', onClick: () => abrirWhatsApp(telefono, comprobante) } }
          : {}
      )
      if (onCobroRegistrado) onCobroRegistrado()
    } catch (err) {
      console.error('Error al registrar cobro:', err)
      setErrorCobro(err.message || 'Error al procesar el cobro.')
    } finally {
      setGuardandoCobro(false)
    }
  }

  // Borra el préstamo y sus cobros (con auditoría)
  const handleBorrarPrestamo = async () => {
    setBorrando(true)
    setErrorBorrado('')
    try {
      // Primero los cobros, por si la base no tiene borrado en cascada
      const { error: errPagos } = await supabase.from('pagos').delete().eq('prestamo_id', prestamo.id)
      if (errPagos) throw errPagos

      const { data: borrado, error } = await supabase.from('prestamos').delete().eq('id', prestamo.id).select()
      if (error) throw error
      if (!borrado || borrado.length === 0) throw new Error('La base de datos no permitió borrar el préstamo (permisos).')

      const { error: errAudit } = await supabase.from('auditoria_actividades').insert([{
        tipo: 'PRÉSTAMO',
        accion: 'ELIMINADO',
        titulo: `Préstamo #${String(prestamo.id).substring(0, 8)} eliminado`,
        subtitulo: `Cliente: ${nombreCliente}`,
        detalles: `Capital $${formatearMonto(capital)} · Total $${formatearMonto(totalPagar)} · Cobrado $${formatearMonto(totalCobrado)} en ${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'}`,
        persona: nombreCliente,
        autor_id: usuarioLogueado?.id || null,
        autor_nombre: usuarioLogueado?.nombre || 'Administración',
        autor_rol: usuarioLogueado?.rol || 'admin',
        estado: 'Eliminado',
        metadata: { ...borrado[0], pagos_eliminados: pagos.length }
      }])
      if (errAudit) console.warn('Aviso al registrar auditoría:', errAudit.message)

      avisar(`Préstamo de ${nombreCliente} eliminado`)
      setConfirmarBorrado(false)
      if (onPrestamoEliminado) onPrestamoEliminado(prestamo.id)
      onClose()
    } catch (err) {
      console.error('Error al borrar préstamo:', err)
      setErrorBorrado(err.message || 'No se pudo borrar el préstamo.')
    } finally {
      setBorrando(false)
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
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="modal-panel w-full max-w-4xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line modal-panel-full h-[92vh] flex flex-col overflow-hidden">
        
        {/* ENCABEZADO */}
        <div className="flex items-center justify-between pb-4 border-b border-line shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">
                FICHA TÉCNICA DE PRÉSTAMO
              </span>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                estadoMostrado === 'finalizado' ? 'bg-blue-100 text-blue-800'
                  : estadoMostrado === 'cancelado' ? 'bg-slate-200 text-slate-700'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {estadoMostrado === 'finalizado' ? 'FINALIZADO' : estadoMostrado || 'ACTIVO'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
              Préstamo #{prestamo.id?.toString().substring(0, 8) || '001'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {puedeAdministrar && (
              <>
                <button type="button" onClick={() => setEditandoPrestamo(true)} aria-label="Editar préstamo" title="Editar préstamo"
                  className="flex items-center gap-1.5 p-2.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <Pencil className="w-4 h-4 text-[#0d6b63]" /> <span className="hidden sm:inline">Editar</span>
                </button>
                <button type="button" onClick={() => { setErrorBorrado(''); setConfirmarBorrado(true) }} aria-label="Borrar préstamo" title="Borrar préstamo"
                  className="flex items-center gap-1.5 p-2.5 sm:px-3 sm:py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100 cursor-pointer">
                  <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Borrar</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto space-y-5 pt-4 pr-1">

          {/* CLIENTE */}
          <div className="p-4 rounded-2xl bg-white border border-line flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63]">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">CLIENTE</span>
                <h4 className="font-bold text-slate-900 text-sm">{nombreCliente}</h4>
                <span className="text-xs text-slate-500 font-medium">
                  Tel: {cliente?.telefono || 'Sin teléfono'}
                  {cliente?.dni ? ` · ${cliente.tipo_documento || 'DNI'} ${cliente.dni}` : ''}
                </span>
              </div>
            </div>
            {cuotasVencidas.length > 0 && (
              <div className="flex flex-col items-start sm:items-end gap-1">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1.5 rounded-xl bg-red-600 text-white">
                  <AlertCircle className="w-4 h-4" />
                  {cuotasVencidas.length === 1 ? '1 cuota vencida' : `${cuotasVencidas.length} cuotas vencidas`}
                </span>
                {punitorioTotalPrestamo > 0 && (
                  <span className="text-xs font-bold text-red-700">
                    Punitorio pendiente: ${formatearMonto(punitorioTotalPrestamo)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* PUNITORIO DE ESTE PRÉSTAMO (exento / general / propio) */}
          <PunitorioPrestamo
            prestamo={prestamo}
            general={punitorioGeneral}
            puedeEditar={usuarioLogueado?.rol === 'owner' || usuarioLogueado?.rol === 'admin'}
            usuarioLogueado={usuarioLogueado}
            nombreCliente={nombreCliente}
            onGuardado={(actualizado) => {
              setPrestamoDB(actualizado)
              if (onCobroRegistrado) onCobroRegistrado()
            }}
          />

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
                      min="0.01"
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

                <CalculadoraPunitorio
                  vencidas={vencidasDelCobro}
                  config={configPunitorio}
                  pendiente={pendienteCobro}
                />

                {punitorioCobro > 0 && (
                  <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900 text-white text-sm font-bold">
                    <span>Total a cobrar (cuota + punitorio)</span>
                    <span>${formatearMonto(redondear2((parseFloat(cobroData.monto_cobrado) || 0) + punitorioCobro))}</span>
                  </div>
                )}

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
                Cobrado: ${formatearMonto(totalCobrado)} de ${formatearMonto(totalPagar)}
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
                          : cuota.vencida
                          ? 'bg-red-50 border-red-300'
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
                              Cuota #{cuota.numeroCuota} — ${formatearMonto(cuota.monto)}
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

                            {esPendiente && !cuota.vencida && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                PENDIENTE
                              </span>
                            )}

                            {cuota.vencida && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                VENCIDA · {cuota.diasAtraso} {cuota.diasAtraso === 1 ? 'DÍA' : 'DÍAS'}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 font-medium mt-0.5 space-x-2">
                            <span className={cuota.vencida ? 'text-red-700 font-bold' : ''}>Vencimiento: {formatearFechaSimple(cuota.fechaVencimiento)}</span>
                            {esParcial && (
                              <span className="text-blue-700 font-bold">
                                · Abonado: ${formatearMonto(cuota.cubiertoEnEstaCuota)} (Resta: ${formatearMonto(cuota.restanteDeEstaCuota)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botón de cobro directo o confirmación */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {cuota.vencida && <BotonWhatsApp datos={datosWhatsApp(cuota)} compacto />}
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
                      {Number(p.punitorio) > 0 && (
                        <span className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          + Punitorio ${formatearMonto(p.punitorio)}
                        </span>
                      )}
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

      {/* Edición de todos los datos del préstamo */}
      <ModalEditarPrestamo
        isOpen={editandoPrestamo}
        onClose={() => setEditandoPrestamo(false)}
        prestamo={prestamo}
        totalCobrado={totalCobrado}
        usuarioLogueado={usuarioLogueado}
        onGuardado={(actualizado) => {
          setPrestamoDB(actualizado)
          cargarDetallesPrestamo()
          if (onCobroRegistrado) onCobroRegistrado()
        }}
      />

      {/* Confirmación de borrado */}
      {confirmarBorrado && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-[#FAF8F5] p-6 shadow-2xl border border-[#E7E2D9] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 border border-red-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-serif font-bold text-slate-900">¿Borrar este préstamo?</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Se eliminará el préstamo #{String(prestamo.id).substring(0, 8)} de <strong>{nombreCliente}</strong>
                {pagos.length > 0
                  ? <> junto con sus <strong>{pagos.length} {pagos.length === 1 ? 'cobro registrado' : 'cobros registrados'}</strong> (${formatearMonto(totalCobrado)})</>
                  : null}. Esta acción no se puede deshacer.
              </p>
              {pagos.length > 0 && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2">
                  Si el préstamo solo quedó sin efecto, conviene usar <strong>Editar → Estado: Cancelado</strong> para conservar el historial de cobros.
                </p>
              )}
            </div>
            {errorBorrado && (
              <p className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">⚠️ {errorBorrado}</p>
            )}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button type="button" disabled={borrando} onClick={() => setConfirmarBorrado(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                Cancelar
              </button>
              <button type="button" disabled={borrando} onClick={handleBorrarPrestamo}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> {borrando ? 'Borrando...' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}