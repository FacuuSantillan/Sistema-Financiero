import React, { useState, useEffect } from 'react'
import { X, Calculator, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalNuevoPrestamo({ isOpen, onClose, onSuccess, usuarioLogueado = null }) {
  const [planes, setPlanes] = useState([])
  const [clientes, setClientes] = useState([])
  const [inversionistas, setInversionistas] = useState([])

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [inversionistaFijado, setInversionistaFijado] = useState(false)

  const [formData, setFormData] = useState({
    plan_id: '',
    cliente_id: '',
    inversionista_id: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    cuota_seleccionada_index: 0
  })

  // 1. Cargar Planes, Clientes e Inversionistas al abrir el modal
// 1. Cargar Planes, Clientes e Inversionistas al abrir el modal
  useEffect(() => {
    if (!isOpen) return

    setErrorMsg('')
    setInversionistaFijado(false)
    setFormData({
      plan_id: '',
      cliente_id: '',
      inversionista_id: '',
      fecha_inicio: new Date().toISOString().split('T')[0],
      cuota_seleccionada_index: 0
    })

    async function cargarDatosIniciales() {
      try {
        // A. Cargar Planes de Préstamo (con opciones_cuotas jsonb)
        const { data: dataPlanes, error: errPlanes } = await supabase
          .from('planes_prestamo')
          .select('*')
          .order('nombre', { ascending: true })

        if (errPlanes) throw errPlanes
        setPlanes(dataPlanes || [])

        // B. Cargar Clientes Activos (usando los nombres exactos del esquema)
        const { data: dataClientes, error: errClientes } = await supabase
          .from('clientes')
          .select('id, nombre_completo, inversionista_id')
          .eq('activo', true)
          .order('nombre_completo', { ascending: true })

        if (errClientes) throw errClientes
        setClientes(dataClientes || [])

        // C. Cargar Inversionistas desde 'usuarios'
        const { data: dataInvs, error: errInvs } = await supabase
          .from('usuarios')
          .select('id, nombre_completo, rol')
          .eq('rol', 'inversionista')
          .order('nombre_completo', { ascending: true })

        if (errInvs) throw errInvs
        setInversionistas(dataInvs || [])

      } catch (err) {
        console.error('Error al cargar datos del modal:', err)
        setErrorMsg(err.message || 'No se pudieron cargar los datos iniciales.')
      }
    }

    cargarDatosIniciales()
  }, [isOpen])

  // 2. Obtener el plan seleccionado y sus opciones de cuota
  const planSeleccionado = planes.find((p) => p.id === formData.plan_id) || null

  const listaOpcionesCuotas = planSeleccionado?.opciones_cuotas && Array.isArray(planSeleccionado.opciones_cuotas) && planSeleccionado.opciones_cuotas.length > 0
    ? planSeleccionado.opciones_cuotas
    : planSeleccionado
    ? [{ cuotas: planSeleccionado.plazo_cuotas || 1, interes: planSeleccionado.tasa_interes || 0 }]
    : []

  const opcionCuotaActiva = listaOpcionesCuotas[formData.cuota_seleccionada_index] || listaOpcionesCuotas[0] || { cuotas: 1, interes: 0 }

  // 3. Cálculos Dinámicos automáticos desde el plan
  const montoCapital = Number(planSeleccionado?.monto || 0)
  const tasaInteres = Number(opcionCuotaActiva.interes || 0)
  const cantidadCuotas = Math.max(1, Number(opcionCuotaActiva.cuotas || 1))
  const montoTotalDevolver = montoCapital > 0 ? montoCapital * (1 + tasaInteres / 100) : 0
  const valorCuota = montoCapital > 0 ? montoTotalDevolver / cantidadCuotas : 0
  const frecuenciaPlan = planSeleccionado?.frecuencia_pago || 'mensual'

  // Manejador del cambio de Cliente: Autodefine el Inversionista vinculado
 const handleClienteChange = (e) => {
    const clienteId = e.target.value
    const clienteEncontrado = clientes.find((c) => c.id === clienteId)

    // Se vincula directamente con inversionista_id del esquema de la tabla clientes
    const invAsignadoId = clienteEncontrado?.inversionista_id || ''

    if (invAsignadoId) {
      setFormData((prev) => ({
        ...prev,
        cliente_id: clienteId,
        inversionista_id: invAsignadoId
      }))
      setInversionistaFijado(true)
    } else {
      setFormData((prev) => ({
        ...prev,
        cliente_id: clienteId,
        inversionista_id: ''
      }))
      setInversionistaFijado(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'plan_id' ? { cuota_seleccionada_index: 0 } : {})
    }))
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
      setErrorMsg('Debes seleccionar o tener un inversionista asignado.')
      setLoading(false)
      return
    }

    try {
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

      // Guardar préstamo en la tabla 'prestamos'
      const payload = {
        cliente_id: formData.cliente_id,
        inversionista_id: formData.inversionista_id,
        creado_por: usuarioId,
        monto_capital: montoCapital,
        monto_total_pagar: montoTotalDevolver,
        cantidad_cuotas: cantidadCuotas,
        monto_cuota: valorCuota,
        frecuencia: frecuenciaPlan,
        fecha_inicio: formData.fecha_inicio,
        estado: 'activo'
      }

      const { data: prestamoCreado, error: errorPrestamo } = await supabase
        .from('prestamos')
        .insert([payload])
        .select()
        .single()

      if (errorPrestamo) throw errorPrestamo

      // Auditoría
      const clienteEncontrado = clientes.find((c) => c.id === formData.cliente_id)
      const inversionistaEncontrado = inversionistas.find((i) => i.id === formData.inversionista_id)

      const nombreCliente = clienteEncontrado?.nombre_completo || 'Cliente'
      const nombreInversionista = inversionistaEncontrado?.nombre_completo || 'Inversionista'

      const auditPayload = {
        tipo: 'PRÉSTAMO',
        accion: 'CREADO',
        titulo: `Préstamo $${montoCapital.toLocaleString('es-AR')}`,
        subtitulo: `Otorgado a ${nombreCliente} · Fondo: ${nombreInversionista}`,
        detalles: `${cantidadCuotas} cuotas (${frecuenciaPlan}) de $${Math.round(valorCuota).toLocaleString('es-AR')} · Total: $${Math.round(montoTotalDevolver).toLocaleString('es-AR')}`,
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

      if (auditError) console.warn('Aviso al registrar auditoría:', auditError.message)

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
                  {p.nombre} — Capital: ${Number(p.monto).toLocaleString('es-AR')} ({p.frecuencia_pago || 'mensual'})
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Esquema de Cuotas (si el plan posee varias opciones de cuota) */}
          {listaOpcionesCuotas.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Elegir plan de cuotas 
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {listaOpcionesCuotas.map((op, idx) => {
                  const esActivo = Number(formData.cuota_seleccionada_index) === idx
                  const totalOpcion = montoCapital * (1 + Number(op.interes || 0) / 100)
                  const cuotaOpcion = totalOpcion / Number(op.cuotas || 1)

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, cuota_seleccionada_index: idx }))}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        esActivo
                          ? 'border-[#0d6b63] bg-white shadow-xs ring-2 ring-[#0d6b63]/20'
                          : 'border-line bg-white/60 hover:bg-white'
                      }`}
                    >
                      <span className="block text-xs font-bold text-slate-800">
                        {op.cuotas} cuotas {Number(op.interes) === 0 ? '(Sin interés)' : `(+${op.interes}%)`}
                      </span>
                      <span className="text-[11px] font-bold text-[#0d6b63] block mt-0.5">
                        ${Math.round(cuotaOpcion).toLocaleString('es-AR')} / cuota
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
                onChange={handleClienteChange}
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Inversionista
                </label>
                {inversionistaFijado && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#0d6b63]">
                    <CheckCircle2 className="w-3 h-3" />
                    Asignado al cliente
                  </span>
                )}
              </div>
              <select
                name="inversionista_id"
                required
                disabled={inversionistaFijado}
                value={formData.inversionista_id}
                onChange={handleChange}
                className={`w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63] cursor-pointer ${
                  inversionistaFijado ? 'bg-slate-100 opacity-80 cursor-not-allowed' : ''
                }`}
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

          {/* Tarjeta Informativa de Totales */}
          <div className="p-4 rounded-2xl bg-[#0d6b63]/10 border border-[#0d6b63]/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#0d6b63] text-white">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">
                  Total a devolver ({cantidadCuotas} cuotas · {frecuenciaPlan})
                </span>
                <span className="text-xl font-bold text-[#0d6b63]">
                  ${montoTotalDevolver.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium block">
                Valor por cuota
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
              disabled={loading || !formData.plan_id || !formData.cliente_id}
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