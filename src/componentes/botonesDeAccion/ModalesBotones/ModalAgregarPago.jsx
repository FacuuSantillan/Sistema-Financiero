import React, { useState, useEffect } from 'react'
import { X, Receipt, AlertCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalPago({ isOpen, onClose, onSuccess, usuarioLogueado = null }) {
  const [clientes, setClientes] = useState([])
  const [prestamosCliente, setPrestamosCliente] = useState([])
  
  const [loading, setLoading] = useState(false)
  const [fetchingPrestamos, setFetchingPrestamos] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    cliente_id: '',
    prestamo_id: '',
    monto_pago: '',
    metodo_pago: 'efectivo',
    fecha_pago: new Date().toISOString().split('T')[0],
    observaciones: ''
  })

  const [detalleCobro, setDetalleCobro] = useState({
    montoTotalPagar: 0,
    montoCuota: 0,
    cantidadCuotas: 1,
    totalPagado: 0,
    saldoPendienteTotal: 0,
    numeroCuotaActual: 1,
    pagadoCuotaActual: 0,
    pendienteCuotaActual: 0,
    esParcial: false
  })

  // 1. Cargar clientes al abrir el modal (iniciando siempre vacío)
  useEffect(() => {
    if (isOpen) {
      setFormData({
        cliente_id: '',
        prestamo_id: '',
        monto_pago: '',
        metodo_pago: 'efectivo',
        fecha_pago: new Date().toISOString().split('T')[0],
        observaciones: ''
      })
      setPrestamosCliente([])
      resetDetalleCobro()
      setErrorMsg('')

      cargarClientesDeInversionista(usuarioLogueado)
    }
  }, [isOpen, usuarioLogueado])

  const cargarClientesDeInversionista = async (usuario) => {
    try {
      const esInversionista = usuario?.rol === 'inversionista'

      if (esInversionista && usuario?.id) {
        const invId = usuario.id

        const { data: prestamosActivos, error: errP } = await supabase
          .from('prestamos')
          .select('cliente_id')
          .eq('inversionista_id', invId)
          .neq('estado', 'finalizado')

        if (errP) throw errP

        const clienteIdsActivos = [...new Set((prestamosActivos || []).map((p) => p.cliente_id))].filter(Boolean)

        if (clienteIdsActivos.length === 0) {
          setClientes([])
          return
        }

        const { data: dataClientes, error: errC } = await supabase
          .from('clientes')
          .select('id, nombre_completo')
          .in('id', clienteIdsActivos)
          .order('nombre_completo', { ascending: true })

        if (errC) throw errC
        setClientes(dataClientes || [])
      } else {
        const { data: prestamosActivos, error: errP } = await supabase
          .from('prestamos')
          .select('cliente_id')
          .neq('estado', 'finalizado')

        if (errP) throw errP

        const clienteIdsActivos = [...new Set((prestamosActivos || []).map((p) => p.cliente_id))].filter(Boolean)

        if (clienteIdsActivos.length === 0) {
          setClientes([])
          return
        }

        const { data: dataClientes, error: errC } = await supabase
          .from('clientes')
          .select('id, nombre_completo')
          .in('id', clienteIdsActivos)
          .order('nombre_completo', { ascending: true })

        if (errC) throw errC
        setClientes(dataClientes || [])
      }
    } catch (err) {
      console.error('Error al cargar clientes con préstamos activos:', err)
      setClientes([])
    }
  }

  // 2. Cargar préstamos activos del cliente seleccionado
  useEffect(() => {
    if (!isOpen) return

    if (!formData.cliente_id) {
      setPrestamosCliente([])
      setFormData((prev) => ({ ...prev, prestamo_id: '', monto_pago: '' }))
      resetDetalleCobro()
      return
    }

    async function loadPrestamos() {
      setFetchingPrestamos(true)
      try {
        let query = supabase
          .from('prestamos')
          .select('*')
          .eq('cliente_id', formData.cliente_id)
          .neq('estado', 'finalizado')

        if (usuarioLogueado?.rol === 'inversionista' && usuarioLogueado?.id) {
          query = query.eq('inversionista_id', usuarioLogueado.id)
        }

        const { data, error } = await query.order('fecha_inicio', { ascending: false })

        if (error) throw error

        setPrestamosCliente(data || [])
        setFormData((prev) => ({ ...prev, prestamo_id: '', monto_pago: '' }))
        resetDetalleCobro()
      } catch (err) {
        console.error('Error al cargar préstamos del cliente:', err)
      } finally {
        setFetchingPrestamos(false)
      }
    }

    loadPrestamos()
  }, [formData.cliente_id, isOpen, usuarioLogueado])

  // 3. Calcular cuotas y saldos al cambiar el préstamo seleccionado
  useEffect(() => {
    if (!formData.prestamo_id || prestamosCliente.length === 0) {
      resetDetalleCobro()
      return
    }

    const prestamo = prestamosCliente.find((p) => p.id === formData.prestamo_id)
    if (!prestamo) return

    async function calcularSaldos() {
      try {
        const { data: pagos, error } = await supabase
          .from('pagos')
          .select('monto_cobrado')
          .eq('prestamo_id', prestamo.id)

        if (error) throw error

        const totalPagado = pagos ? pagos.reduce((acc, curr) => acc + Number(curr.monto_cobrado || 0), 0) : 0
        
        const montoTotalPagar = Number(prestamo.monto_total_pagar || 0)
        const cantidadCuotas = Math.max(1, Number(prestamo.cantidad_cuotas || 1))
        
        const montoCuotaCalculado = montoTotalPagar / cantidadCuotas
        const montoCuota = Number(prestamo.monto_cuota) || montoCuotaCalculado || 0
        
        const saldoPendienteTotal = Math.max(0, montoTotalPagar - totalPagado)

        const cuotasCompletadas = Math.floor(totalPagado / (montoCuota || 1))
        const pagadoCuotaActual = totalPagado % (montoCuota || 1)

        let numeroCuotaActual = cuotasCompletadas + 1
        if (numeroCuotaActual > cantidadCuotas) {
          numeroCuotaActual = cantidadCuotas
        }

        let pendienteCuotaActual = montoCuota - pagadoCuotaActual
        if (pendienteCuotaActual > saldoPendienteTotal) {
          pendienteCuotaActual = saldoPendienteTotal
        }

        const esParcial = pagadoCuotaActual > 0 && pagadoCuotaActual < montoCuota

        setDetalleCobro({
          montoTotalPagar,
          montoCuota,
          cantidadCuotas,
          totalPagado,
          saldoPendienteTotal,
          numeroCuotaActual,
          pagadoCuotaActual,
          pendienteCuotaActual,
          esParcial
        })

        setFormData((prev) => ({
          ...prev,
          monto_pago: pendienteCuotaActual > 0 ? pendienteCuotaActual.toFixed(2) : '0.00'
        }))
      } catch (err) {
        console.error('Error al calcular saldos del préstamo:', err)
      }
    }

    calcularSaldos()
  }, [formData.prestamo_id, prestamosCliente])

  const resetDetalleCobro = () => {
    setDetalleCobro({
      montoTotalPagar: 0,
      montoCuota: 0,
      cantidadCuotas: 1,
      totalPagado: 0,
      saldoPendienteTotal: 0,
      numeroCuotaActual: 1,
      pagadoCuotaActual: 0,
      pendienteCuotaActual: 0,
      esParcial: false
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    if (!formData.cliente_id) {
      setErrorMsg('Debes seleccionar un cliente.')
      setLoading(false)
      return
    }

    if (!formData.prestamo_id) {
      setErrorMsg('Debes seleccionar un préstamo activo para registrar el pago.')
      setLoading(false)
      return
    }

    const monto = parseFloat(formData.monto_pago || 0)
    if (monto <= 0) {
      setErrorMsg('El monto a cobrar debe ser mayor a 0.')
      setLoading(false)
      return
    }

    const prestamoActual = prestamosCliente.find((p) => p.id === formData.prestamo_id)
    const clienteActual = clientes.find((c) => c.id === formData.cliente_id)
    const nombreCliente = clienteActual?.nombre_completo || 'Cliente'

    try {
      // 1. Obtener datos del usuario logueado responsable
      let usuarioId = usuarioLogueado?.id
      if (!usuarioId) {
        const { data: authData } = await supabase.auth.getUser()
        usuarioId = authData?.user?.id
      }

      let autorNombre = 'Administración'
      let autorRol = 'admin'

      if (usuarioId) {
        const { data: autorData } = await supabase
          .from('usuarios')
          .select('nombre_completo, rol')
          .eq('id', usuarioId)
          .maybeSingle()

        if (autorData) {
          autorNombre = autorData.nombre_completo || 'Administración'
          autorRol = autorData.rol || 'admin'
        }
      }

      // 2. Insertar pago en la tabla 'pagos'
      const payload = {
        prestamo_id: formData.prestamo_id,
        cliente_id: formData.cliente_id,
        inversionista_id: prestamoActual?.inversionista_id || null,
        creado_por: usuarioId || null,
        monto_cobrado: monto,
        metodo_pago: formData.metodo_pago,
        fecha_pago: formData.fecha_pago ? new Date(`${formData.fecha_pago}T12:00:00Z`).toISOString() : new Date().toISOString(),
        observaciones: formData.observaciones?.trim() || null
      }

      const { data: pagoCreado, error: errorPago } = await supabase
        .from('pagos')
        .insert([payload])
        .select()
        .single()

      if (errorPago) throw errorPago

      // 3. Registrar el evento en la tabla 'auditoria_actividades'
      const auditPayload = {
        tipo: 'COBRO',
        accion: 'COBRO',
        titulo: `Ingreso $${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        subtitulo: `Cobro a ${nombreCliente}`,
        detalles: `Método: ${formData.metodo_pago}${formData.observaciones ? ` · ${formData.observaciones.trim()}` : ''}`,
        persona: nombreCliente,
        autor_id: usuarioId || null,
        autor_nombre: autorNombre,
        autor_rol: autorRol,
        estado: 'Registrado',
        metadata: {
          ...(pagoCreado || payload),
          clientes: { nombre_completo: nombreCliente }
        }
      }

      const { error: errAudit } = await supabase
        .from('auditoria_actividades')
        .insert([auditPayload])

      if (errAudit) console.warn('Aviso al registrar auditoría de cobro:', errAudit.message)

      // 4. Verificar si el préstamo se canceló en su totalidad
      const { data: todosLosPagos, error: errSum } = await supabase
        .from('pagos')
        .select('monto_cobrado')
        .eq('prestamo_id', formData.prestamo_id)

      if (errSum) throw errSum

      const totalAcumuladoDB = (todosLosPagos || []).reduce(
        (acc, p) => acc + Number(p.monto_cobrado || 0),
        0
      )

      const montoTotalPagar = Number(prestamoActual?.monto_total_pagar || 0)

      if (totalAcumuladoDB >= (montoTotalPagar - 0.50)) {
        const { error: errorPrestamo } = await supabase
          .from('prestamos')
          .update({ estado: 'finalizado' })
          .eq('id', formData.prestamo_id)

        if (errorPrestamo) throw errorPrestamo
      }

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error('Error al guardar el pago:', err)
      setErrorMsg(err.message || 'No se pudo guardar el registro de cobro.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line max-h-[92vh] overflow-y-auto">
        
        {/* Cabecera */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">
              ALTA DE REGISTRO
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
              Nuevo cobro / pago
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Tipo de movimiento
            </label>
            <select
              disabled
              value="pago"
              className="w-full rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm font-medium text-slate-800 cursor-not-allowed"
            >
              <option value="pago">Cobro / Pago de cuota</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cliente
              </label>
              <select
                name="cliente_id"
                required
                value={formData.cliente_id}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                {clientes.length === 0 ? (
                  <option value="">No tenés clientes con préstamos activos</option>
                ) : (
                  <>
                    <option value="">-- Seleccioná un cliente --</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre_completo}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Préstamo activo a cobrar
              </label>
              <select
                name="prestamo_id"
                required
                disabled={fetchingPrestamos || prestamosCliente.length === 0 || !formData.cliente_id}
                value={formData.prestamo_id}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] disabled:opacity-50 cursor-pointer"
              >
                {fetchingPrestamos ? (
                  <option value="">Buscando préstamos...</option>
                ) : !formData.cliente_id ? (
                  <option value="">Primero seleccioná un cliente</option>
                ) : prestamosCliente.length === 0 ? (
                  <option value="">Sin préstamos activos para este cliente</option>
                ) : (
                  <>
                    <option value="">-- Seleccioná el préstamo --</option>
                    {prestamosCliente.map((p) => (
                      <option key={p.id} value={p.id}>
                        Préstamo ${Number(p.monto_capital).toLocaleString('es-AR')} ({p.frecuencia || 'mensual'})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Tarjeta Informativa de Cuota */}
          {formData.prestamo_id && (
            <div className={`p-4 rounded-2xl border ${detalleCobro.esParcial ? 'bg-amber-50 border-amber-300' : 'bg-[#0d6b63]/5 border-[#0d6b63]/20'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${detalleCobro.esParcial ? 'bg-amber-600 text-white' : 'bg-[#0d6b63] text-white'}`}>
                    {detalleCobro.esParcial ? <AlertCircle className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                      Cuota {detalleCobro.numeroCuotaActual} de {detalleCobro.cantidadCuotas}
                      {detalleCobro.esParcial && <span className="ml-2 text-amber-700 font-bold">(Pago Parcial)</span>}
                    </span>
                    <p className="text-sm text-slate-700 font-medium mt-0.5">
                      {detalleCobro.esParcial ? (
                        <>Se abonó <strong>${detalleCobro.pagadoCuotaActual.toLocaleString('es-AR')}</strong> de ${detalleCobro.montoCuota.toLocaleString('es-AR')}</>
                      ) : (
                        <>Valor regular de la cuota: <strong>${detalleCobro.montoCuota.toLocaleString('es-AR')}</strong></>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 font-medium block">
                    Pendiente de esta cuota
                  </span>
                  <span className={`text-base font-bold ${detalleCobro.esParcial ? 'text-amber-700' : 'text-[#0d6b63]'}`}>
                    ${detalleCobro.pendienteCuotaActual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Monto y Método de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Monto a cobrar ($)
              </label>
              <input
                type="number"
                name="monto_pago"
                min="1"
                step="any"
                required
                value={formData.monto_pago}
                onChange={handleChange}
                placeholder="0"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-[#0d6b63] focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Método de pago
              </label>
              <select
                name="metodo_pago"
                value={formData.metodo_pago}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia Bancaria</option>
                <option value="mercadopago">📱 Mercado Pago</option>
              </select>
            </div>
          </div>

          {/* Fecha de Pago y Observaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha del cobro
              </label>
              <input
                type="date"
                name="fecha_pago"
                required
                value={formData.fecha_pago}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observación / Comprobante (Opcional)
              </label>
              <input
                type="text"
                name="observaciones"
                value={formData.observaciones}
                onChange={handleChange}
                placeholder="Ej. Saldo de Cuota 1 / Nro Op 1234"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">
              ⚠️ {errorMsg}
            </p>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-line bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.prestamo_id}
              className="px-5 py-2.5 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm shadow-sm hover:bg-[#0b5a52] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Registrando...' : 'Registrar cobro'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}