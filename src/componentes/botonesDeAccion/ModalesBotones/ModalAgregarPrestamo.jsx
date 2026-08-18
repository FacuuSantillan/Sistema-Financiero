import React, { useState, useEffect } from 'react'
import { X, Calculator } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalNuevoPrestamo({ isOpen, onClose, onSuccess, usuarioLogueado = null }) {
  const [planes, setPlanes] = useState([])
  const [clientes, setClientes] = useState([])
  const [inversionistas, setInversionistas] = useState([])

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    plan_id: '',
    cliente_id: '',
    inversionista_id: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    cantidad_cuotas: 12,
    frecuencia: 'mensual'
  })

  // 1. Cargar Planes, Clientes e Inversionistas al abrir el modal (todo en blanco)
  useEffect(() => {
    if (!isOpen) return

    setErrorMsg('')
    setFormData({
      plan_id: '',
      cliente_id: '',
      inversionista_id: '',
      fecha_inicio: new Date().toISOString().split('T')[0],
      cantidad_cuotas: 12,
      frecuencia: 'mensual'
    })

    async function cargarDatosIniciales() {
      try {
        // A. Cargar Planes de Préstamos
        const { data: dataPlanes, error: errPlanes } = await supabase
          .from('planes_prestamo')
          .select('*')
          .order('nombre', { ascending: true })

        if (errPlanes) throw errPlanes
        setPlanes(dataPlanes || [])

        // B. Cargar Clientes Activos
        const { data: dataClientes, error: errClientes } = await supabase
          .from('clientes')
          .select('id, nombre_completo')
          .eq('activo', true)
          .order('nombre_completo', { ascending: true })

        if (errClientes) throw errClientes
        setClientes(dataClientes || [])

        // C. Cargar Inversionistas Activos
        const { data: dataInvs, error: errInvs } = await supabase
          .from('usuarios')
          .select('id, nombre_completo, rol')
          .eq('rol', 'inversionista')
          .eq('activo', true)
          .order('nombre_completo', { ascending: true })

        if (errInvs) throw errInvs
        setInversionistas(dataInvs || [])

      } catch (err) {
        console.error('Error al cargar datos del modal:', err)
        setErrorMsg('No se pudieron cargar los datos iniciales.')
      }
    }

    cargarDatosIniciales()
  }, [isOpen])

  // 2. Obtener el plan de préstamo (solo si fue seleccionado por el usuario)
  const planSeleccionado = planes.find((p) => p.id === formData.plan_id) || null

  // 3. Cálculos Dinámicos
  const montoCapital = Number(planSeleccionado?.monto || 0)
  const tasaInteres = Number(planSeleccionado?.tasa_interes || 0)
  const montoTotalDevolver = montoCapital > 0 ? montoCapital + (montoCapital * (tasaInteres / 100)) : 0
  const cantidadCuotas = Math.max(1, Number(formData.cantidad_cuotas || 1))
  const valorCuota = montoCapital > 0 ? (montoTotalDevolver / cantidadCuotas) : 0

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Actualizar cuotas y frecuencia si cambia el plan seleccionado
    if (name === 'plan_id') {
      const nuevoPlan = planes.find((p) => p.id === value)
      if (nuevoPlan) {
        setFormData((prev) => ({
          ...prev,
          plan_id: value,
          cantidad_cuotas: nuevoPlan.plazo_cuotas || 12,
          frecuencia: nuevoPlan.frecuencia_pago || 'mensual'
        }))
      }
    }
  }

  // 4. Guardar Préstamo en Supabase y registrar en Auditoría
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    if (!formData.plan_id) {
      setErrorMsg('Debes seleccionar una opción de préstamo.')
      setLoading(false)
      return
    }

    if (!formData.cliente_id) {
      setErrorMsg('Debes seleccionar un cliente.')
      setLoading(false)
      return
    }

    if (!formData.inversionista_id) {
      setErrorMsg('Debes seleccionar un inversionista.')
      setLoading(false)
      return
    }

    try {
      // Obtener el ID y datos del autor que ejecuta la creación
      let usuarioId = usuarioLogueado?.id
      if (!usuarioId) {
        const { data: authUserResp } = await supabase.auth.getUser()
        usuarioId = authUserResp?.user?.id || null
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

      // 1. Guardar préstamo en la tabla 'prestamos'
      const payload = {
        cliente_id: formData.cliente_id,
        inversionista_id: formData.inversionista_id,
        creado_por: usuarioId,
        monto_capital: montoCapital,
        monto_total_pagar: montoTotalDevolver,
        cantidad_cuotas: cantidadCuotas,
        monto_cuota: valorCuota,
        frecuencia: formData.frecuencia || 'mensual',
        fecha_inicio: formData.fecha_inicio,
        estado: 'activo'
      }

      const { data: prestamoCreado, error: errorPrestamo } = await supabase
        .from('prestamos')
        .insert([payload])
        .select()
        .single()

      if (errorPrestamo) throw errorPrestamo

      // 2. Obtener nombres auxiliares para la tarjeta de auditoría
      const clienteEncontrado = clientes.find((c) => c.id === formData.cliente_id)
      const inversionistaEncontrado = inversionistas.find((i) => i.id === formData.inversionista_id)

      const nombreCliente = clienteEncontrado?.nombre_completo || 'Cliente'
      const nombreInversionista = inversionistaEncontrado?.nombre_completo || 'Inversionista'

      // 3. Registrar el evento en la tabla 'auditoria_actividades'
      const auditPayload = {
        tipo: 'PRÉSTAMO',
        accion: 'CREADO',
        titulo: `Préstamo $${montoCapital.toLocaleString('es-AR')}`,
        subtitulo: `Otorgado a ${nombreCliente} · Fondo: ${nombreInversionista}`,
        detalles: `${cantidadCuotas} cuotas ${formData.frecuencia || 'mensual'} · Total: $${montoTotalDevolver.toLocaleString('es-AR')}`,
        persona: nombreCliente,
        autor_id: usuarioId,
        autor_nombre: autorNombre,
        autor_rol: autorRol,
        estado: 'Activo',
        metadata: {
          ...(prestamoCreado || payload),
          clientes: { nombre_completo: nombreCliente },
          inversionistas: { nombre_completo: nombreInversionista }
        }
      }

      const { error: auditError } = await supabase
        .from('auditoria_actividades')
        .insert([auditPayload])

      if (auditError) console.warn('Aviso al registrar auditoría del préstamo:', auditError.message)

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error('Error al guardar el préstamo:', err)
      setErrorMsg(err.message || 'No se pudo guardar el registro del préstamo.')
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
              Nuevo préstamo
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
          
          {/* Opción / Plan de Préstamo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              OPCIÓN DE PRÉSTAMO
            </label>
            <select
              name="plan_id"
              required
              value={formData.plan_id}
              onChange={handleChange}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
            >
              <option value="">-- Seleccioná una opción de préstamo --</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — Monto: ${Number(p.monto).toLocaleString('es-AR')} | Tasa: {p.tasa_interes}%
                </option>
              ))}
            </select>
          </div>

          {/* Cliente e Inversionista */}
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
                <option value="">-- Seleccioná un cliente --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_completo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Inversionista
              </label>
              <select
                name="inversionista_id"
                required
                value={formData.inversionista_id}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                <option value="">-- Seleccioná un inversionista --</option>
                {inversionistas.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre_completo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fecha de Emisión */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Fecha de inicio / emisión
            </label>
            <input
              type="date"
              name="fecha_inicio"
              required
              value={formData.fecha_inicio}
              onChange={handleChange}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
            />
          </div>

          {/* Cuotas y Frecuencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cantidad de cuotas
              </label>
              <input
                type="number"
                name="cantidad_cuotas"
                min="1"
                required
                value={formData.cantidad_cuotas}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Frecuencia de pago
              </label>
              <select
                name="frecuencia"
                value={formData.frecuencia}
                onChange={handleChange}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer"
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
          </div>

          {/* Tarjeta Informativa de Totales */}
          <div className="p-4 rounded-2xl bg-[#0d6b63]/10 border border-[#0d6b63]/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#0d6b63] text-white">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">
                  Total a devolver ({cantidadCuotas} cuotas)
                </span>
                <span className="text-xl font-bold text-[#0d6b63]">
                  ${montoTotalDevolver.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium block">
                Valor cuota
              </span>
              <span className="text-lg font-bold text-slate-900">
                ${valorCuota.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">
              ⚠️ {errorMsg}
            </p>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-line bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.plan_id}
              className="px-5 py-2.5 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm shadow-sm hover:bg-[#0b5a52] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Guardando...' : 'Guardar préstamo'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}