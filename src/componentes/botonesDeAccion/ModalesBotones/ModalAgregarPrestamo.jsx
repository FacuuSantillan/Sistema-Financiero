import React, { useState, useEffect } from 'react'
import { X, Calculator } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { avisar } from '../../../lib/avisos'
import { abrirTicket } from '../../../lib/tickets'
import { hoyLocalISO, redondear2 } from '../../../lib/finanzas'
import { usePunitorioGeneral } from '../../../lib/usePunitorioGeneral'
import { CampoDias, describirPunitorio } from '../../comunes/CalculadoraPunitorio'

const PUNITORIO_INICIAL = { modo: 'general', tasa: '', cadaDias: '' } // modo: general | propio | exento

export default function ModalNuevoPrestamo({ isOpen, onClose, onSuccess, usuarioLogueado = null }) {
  const [planes, setPlanes] = useState([])
  const [clientes, setClientes] = useState([])

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Punitorio del préstamo: por defecto la configuración general (obligatoria)
  const { config: punitorioGeneral } = usePunitorioGeneral(isOpen)
  const [punitorio, setPunitorio] = useState(PUNITORIO_INICIAL)

  const [formData, setFormData] = useState({
    plan_id: '',
    cliente_id: '',
    fecha_inicio: hoyLocalISO(),
    cuota_seleccionada_index: 0
  })

  // 1. Cargar Planes y Clientes al abrir el modal
  useEffect(() => {
    if (!isOpen) return

    setErrorMsg('')
    setPunitorio(PUNITORIO_INICIAL)
    setFormData({
      plan_id: '',
      cliente_id: '',
      fecha_inicio: hoyLocalISO(),
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
          .select('id, nombre_completo')
          .eq('activo', true)
          .order('nombre_completo', { ascending: true })

        if (errClientes) throw errClientes
        setClientes(dataClientes || [])
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
  const montoTotalDevolver = montoCapital > 0 ? redondear2(montoCapital * (1 + tasaInteres / 100)) : 0
  const valorCuota = montoCapital > 0 ? redondear2(montoTotalDevolver / cantidadCuotas) : 0
  const frecuenciaPlan = planSeleccionado?.frecuencia_pago || 'mensual'

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

    if (!(montoCapital > 0)) {
      setErrorMsg('La opción de préstamo elegida no tiene un capital válido.')
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
        inversionista_id: null,
        creado_por: usuarioId,
        monto_capital: montoCapital,
        monto_total_pagar: montoTotalDevolver,
        cantidad_cuotas: cantidadCuotas,
        monto_cuota: valorCuota,
        frecuencia: frecuenciaPlan,
        fecha_inicio: formData.fecha_inicio,
        estado: 'activo'
      }

      // Punitorio: con "general" se dejan los valores por defecto de la base
      if (punitorio.modo === 'exento') {
        payload.punitorio_aplica = false
      } else if (punitorio.modo === 'propio') {
        payload.punitorio_aplica = true
        payload.punitorio_tasa = Math.max(0, Number(punitorio.tasa) || 0)
        payload.punitorio_cada_dias = Math.max(1, Math.floor(Number(punitorio.cadaDias) || 1))
      }

      const { data: prestamoCreado, error: errorPrestamo } = await supabase
        .from('prestamos')
        .insert([payload])
        .select()
        .single()

      if (errorPrestamo) throw errorPrestamo

      // Auditoría
      const clienteEncontrado = clientes.find((c) => c.id === formData.cliente_id)
      const nombreCliente = clienteEncontrado?.nombre_completo || 'Cliente'

      const auditPayload = {
        tipo: 'PRÉSTAMO',
        accion: 'CREADO',
        titulo: `Préstamo $${montoCapital.toLocaleString('es-AR')}`,
        subtitulo: `Otorgado a ${nombreCliente}`,
        detalles: `${cantidadCuotas} cuotas (${frecuenciaPlan}) de $${valorCuota.toLocaleString('es-AR', { minimumFractionDigits: 2 })} · Total: $${montoTotalDevolver.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        persona: nombreCliente,
        autor_id: usuarioId,
        autor_nombre: autorNombre,
        autor_rol: autorRol,
        estado: 'Activo',
        metadata: {
          ...(prestamoCreado || payload),
          clientes: { nombre_completo: nombreCliente }
        }
      }

      const { error: auditError } = await supabase
        .from('auditoria_actividades')
        .insert([auditPayload])

      if (auditError) console.warn('Aviso al registrar auditoría:', auditError.message)

      avisar(`Préstamo de $${montoCapital.toLocaleString('es-AR')} creado para ${nombreCliente}`)
      // Ticket del préstamo para imprimir, exportar o mandar por WhatsApp
      if (prestamoCreado?.id) abrirTicket('prestamo', prestamoCreado.id)
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
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="modal-panel w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line max-h-[92vh] overflow-y-auto">
        
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

          {/* Cliente */}
          <div>
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

          {/* Punitorio por mora */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Punitorio por mora</label>
            <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-2xl border border-line">
              {[
                { id: 'general', label: 'General' },
                { id: 'propio', label: 'Propio' },
                { id: 'exento', label: 'Exento' }
              ].map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setPunitorio((p) => ({
                    ...p,
                    modo: op.id,
                    ...(op.id === 'propio' && p.tasa === '' ? { tasa: String(punitorioGeneral.tasa), cadaDias: String(punitorioGeneral.cadaDias) } : {})
                  }))}
                  className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${punitorio.modo === op.id ? 'bg-[#0d6b63] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {op.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {punitorio.modo === 'general' && <>Se aplica la configuración general: <strong>{describirPunitorio(punitorioGeneral)}</strong>.</>}
              {punitorio.modo === 'exento' && 'Este préstamo no generará punitorio por cuotas vencidas.'}
              {punitorio.modo === 'propio' && 'Punitorio solo para este préstamo:'}
            </p>
            {punitorio.modo === 'propio' && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Interés (%)</label>
                  <input type="number" min="0" step="0.01" value={punitorio.tasa}
                    onChange={(e) => setPunitorio((p) => ({ ...p, tasa: e.target.value }))}
                    className="w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Cada (días)</label>
                  <CampoDias valor={punitorio.cadaDias} onCambiar={(v) => setPunitorio((p) => ({ ...p, cadaDias: v }))}
                    className="w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20" />
                </div>
              </div>
            )}
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
          <div className="form-acciones flex justify-end items-center gap-3 pt-3">
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