import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Edit2, Layers, CreditCard, Search, ArrowLeft } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

export default function ModalCrearPlan({ isOpen, onClose, onSuccess, usuarioLogueado = null }) {
  // Lista de planes existentes
  const [planes, setPlanes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loadingPlanes, setLoadingPlanes] = useState(false)

  // Estado del formulario (modo creación o edición)
  const [planEnEdicionId, setPlanEnEdicionId] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    monto: '',
    frecuencia_pago: 'mensual'
  })

  // Esquema de cuotas dinámico
  const [opcionesCuotas, setOpcionesCuotas] = useState([
    { cuotas: '1', interes: '0' },
    { cuotas: '3', interes: '15' },
    { cuotas: '6', interes: '30' }
  ])

  const [loadingGuardado, setLoadingGuardado] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Cargar planes de la base de datos
  const cargarPlanes = async () => {
    setLoadingPlanes(true)
    try {
      const { data, error } = await supabase
        .from('planes_prestamo')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPlanes(data || [])
    } catch (err) {
      console.error('Error al cargar planes:', err)
    } finally {
      setLoadingPlanes(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      cargarPlanes()
      limpiarFormulario()
    }
  }, [isOpen])

  const capitalizarPalabras = (texto) => {
    if (!texto) return ''
    return texto
      .toLowerCase()
      .replace(/(?:^|\s|-)\S/g, (caracter) => caracter.toUpperCase())
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let valorFinal = value
    if (name === 'nombre') {
      valorFinal = capitalizarPalabras(value)
    }
    setFormData((prev) => ({ ...prev, [name]: valorFinal }))
  }

  const handleCuotaChange = (index, field, value) => {
    setOpcionesCuotas((prev) => {
      const actualizadas = [...prev]
      actualizadas[index] = { ...actualizadas[index], [field]: value }
      return actualizadas
    })
  }

  const handleAgregarCuota = () => {
    const ultimaCuota = opcionesCuotas[opcionesCuotas.length - 1]
    const proximaCuotaNum = ultimaCuota ? parseInt(ultimaCuota.cuotas, 10) + 3 : 1
    const proximoInteresNum = ultimaCuota ? parseFloat(ultimaCuota.interes) + 15 : 10

    setOpcionesCuotas((prev) => [
      ...prev,
      { cuotas: String(proximaCuotaNum), interes: String(proximoInteresNum) }
    ])
  }

  const handleEliminarCuota = (index) => {
    if (opcionesCuotas.length <= 1) return
    setOpcionesCuotas((prev) => prev.filter((_, i) => i !== index))
  }

  const limpiarFormulario = () => {
    setPlanEnEdicionId(null)
    setFormData({
      nombre: '',
      monto: '',
      frecuencia_pago: 'mensual'
    })
    setOpcionesCuotas([
      { cuotas: '1', interes: '0' },
      { cuotas: '3', interes: '15' },
      { cuotas: '6', interes: '30' }
    ])
    setErrorMsg('')
  }

  // Cargar datos de un plan para editar
  const seleccionarParaEditar = (plan) => {
    setPlanEnEdicionId(plan.id)
    setFormData({
      nombre: plan.nombre || '',
      monto: plan.monto ? String(plan.monto) : '',
      frecuencia_pago: plan.frecuencia_pago || 'mensual'
    })

    if (Array.isArray(plan.opciones_cuotas) && plan.opciones_cuotas.length > 0) {
      setOpcionesCuotas(
        plan.opciones_cuotas.map((op) => ({
          cuotas: String(op.cuotas),
          interes: String(op.interes)
        }))
      )
    } else {
      setOpcionesCuotas([
        {
          cuotas: String(plan.plazo_cuotas || '1'),
          interes: String(plan.tasa_interes || '0')
        }
      ])
    }
  }

  // Eliminar un plan
  const handleBorrarPlan = async (id, e) => {
    e.stopPropagation()
    const confirmar = window.confirm('¿Seguro que deseas eliminar esta opción de préstamo?')
    if (!confirmar) return

    try {
      const { error } = await supabase.from('planes_prestamo').delete().eq('id', id)
      if (error) throw error

      setPlanes((prev) => prev.filter((p) => p.id !== id))
      if (planEnEdicionId === id) limpiarFormulario()
      if (onSuccess) onSuccess()
    } catch (err) {
      alert(`No se pudo eliminar: ${err.message}`)
    }
  }

  // Guardar (Crear o Actualizar)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoadingGuardado(true)
    setErrorMsg('')

    const nombreLimpio = formData.nombre.trim()
    const montoNum = parseFloat(formData.monto)

    const opcionesValidadas = opcionesCuotas
      .map((op) => ({
        cuotas: parseInt(op.cuotas, 10),
        interes: parseFloat(op.interes) || 0
      }))
      .filter((op) => !isNaN(op.cuotas) && op.cuotas > 0)
      .sort((a, b) => a.cuotas - b.cuotas)

    if (opcionesValidadas.length === 0) {
      setErrorMsg('Debes ingresar al menos una cuota válida.')
      setLoadingGuardado(false)
      return
    }

    try {
      const primeraOpcion = opcionesValidadas[0]

      const payload = {
        nombre: nombreLimpio,
        monto: montoNum,
        tasa_interes: primeraOpcion.interes,
        plazo_cuotas: primeraOpcion.cuotas,
        opciones_cuotas: opcionesValidadas,
        frecuencia_pago: formData.frecuencia_pago
      }

      if (planEnEdicionId) {
        // ACTUALIZAR EXISTENTE
        const { error } = await supabase
          .from('planes_prestamo')
          .update(payload)
          .eq('id', planEnEdicionId)

        if (error) throw error
      } else {
        // CREAR NUEVO
        payload.creado_por = usuarioLogueado?.id || null
        const { error } = await supabase.from('planes_prestamo').insert([payload])
        if (error) throw error
      }

      await cargarPlanes()
      limpiarFormulario()
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error('Error al guardar opción:', err)
      setErrorMsg(err.message || 'Error al guardar la opción.')
    } finally {
      setLoadingGuardado(false)
    }
  }

  if (!isOpen) return null

  const montoBase = parseFloat(formData.monto) || 0
  const planesFiltrados = planes.filter((p) =>
    (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-5xl rounded-3xl bg-cream p-6 sm:p-7 shadow-2xl border border-line h-[90vh] flex flex-col overflow-hidden">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center pb-4 border-b border-line shrink-0">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#0d6b63]">
              CONFIGURACIÓN DE PRÉSTAMOS
            </span>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1d2939]">
              Planes y Opciones de Financiación
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido en dos columnas */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 flex-1 overflow-hidden">
          
          {/* COLUMNA IZQUIERDA: LISTA DE PLANES EXISTENTES */}
          <div className="md:col-span-5 flex flex-col h-full border-r border-line pr-0 md:pr-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Planes Activos ({planes.length})
              </span>
              <button
                type="button"
                onClick={limpiarFormulario}
                className="flex items-center gap-1 text-xs font-bold text-[#0d6b63] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear nuevo</span>
              </button>
            </div>

            {/* Buscador de planes */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar opción..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-line text-slate-800 focus:outline-none focus:border-[#0d6b63]"
              />
            </div>

            {/* Lista scrollable */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingPlanes ? (
                <p className="text-xs text-slate-400 text-center py-6">Cargando opciones...</p>
              ) : planesFiltrados.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No se encontraron planes.</p>
              ) : (
                planesFiltrados.map((p) => {
                  const estaSeleccionado = planEnEdicionId === p.id
                  const cuotasArr = Array.isArray(p.opciones_cuotas) && p.opciones_cuotas.length > 0 
                    ? p.opciones_cuotas 
                    : [{ cuotas: p.plazo_cuotas, interes: p.tasa_interes }]

                  return (
                    <div
                      key={p.id}
                      onClick={() => seleccionarParaEditar(p)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        estaSeleccionado
                          ? 'bg-white border-[#0d6b63] shadow-sm'
                          : 'bg-white/70 border-line hover:bg-white'
                      }`}
                    >
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{p.nombre}</h4>
                        <span className="text-xs text-[#0d6b63] font-bold block mt-0.5">
                          ${Number(p.monto || 0).toLocaleString('es-AR')}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cuotasArr.map((cuo, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md"
                            >
                              {cuo.cuotas}c ({cuo.interes}%)
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => seleccionarParaEditar(p)}
                          className="p-1.5 text-slate-400 hover:text-[#0d6b63] rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleBorrarPlan(p.id, e)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: FORMULARIO DE CREACIÓN / EDICIÓN */}
          <div className="md:col-span-7 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {planEnEdicionId ? 'Modificar Plan Seleccionado' : 'Crear Nuevo Plan de Cuotas'}
              </span>
              {planEnEdicionId && (
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Crear otro</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre del Plan / Opción
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    required
                    placeholder="Ej. Plan Personal Estándar"
                    value={formData.nombre}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0d6b63]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Monto Capital Base ($)
                    </label>
                    <input
                      type="number"
                      name="monto"
                      min="1"
                      step="any"
                      required
                      placeholder="1000000"
                      value={formData.monto}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0d6b63]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Frecuencia de cobro
                    </label>
                    <select
                      name="frecuencia_pago"
                      value={formData.frecuencia_pago}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0d6b63] cursor-pointer"
                    >
                      <option value="diario">Diario</option>
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  </div>
                </div>

                {/* Esquema de cuotas dinámicas */}
                <div className="pt-2 border-t border-line">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#0d6b63]" />
                      <label className="text-xs font-bold text-slate-800">
                        Opciones de cuotas e intereses
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleAgregarCuota}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63] hover:bg-[#0d6b63] hover:text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Agregar cuota</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {opcionesCuotas.map((op, idx) => {
                      const cuotasNum = parseInt(op.cuotas, 10) || 1
                      const tasaNum = parseFloat(op.interes) || 0
                      const montoTotal = montoBase * (1 + tasaNum / 100)
                      const valorCuota = montoBase > 0 ? montoTotal / cuotasNum : 0

                      return (
                        <div
                          key={idx}
                          className="p-2.5 bg-white rounded-2xl border border-line flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">
                                Cuotas
                              </span>
                              <input
                                type="number"
                                min="1"
                                required
                                value={op.cuotas}
                                onChange={(e) => handleCuotaChange(idx, 'cuotas', e.target.value)}
                                className="w-full px-2 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0d6b63]"
                              />
                            </div>

                            <div className="w-20">
                              <span className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">
                                Interés %
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                required
                                value={op.interes}
                                onChange={(e) => handleCuotaChange(idx, 'interes', e.target.value)}
                                className="w-full px-2 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0d6b63]"
                              />
                            </div>
                          </div>

                          <div className="text-right text-xs">
                            {montoBase > 0 ? (
                              <>
                                <span className="block font-bold text-slate-800">
                                  {cuotasNum}x ${Math.round(valorCuota).toLocaleString('es-AR')}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Total: ${Math.round(montoTotal).toLocaleString('es-AR')}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Monto pendiente</span>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={opcionesCuotas.length <= 1}
                            onClick={() => handleEliminarCuota(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-20 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">
                    ⚠️ {errorMsg}
                  </p>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-line mt-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-line bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={loadingGuardado}
                  className="px-5 py-2 rounded-xl bg-[#0d6b63] text-white text-xs font-bold hover:bg-[#0b5a52] transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {loadingGuardado
                    ? 'Guardando...'
                    : planEnEdicionId
                    ? 'Guardar Cambios'
                    : 'Crear Opción'}
                </button>
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  )
}