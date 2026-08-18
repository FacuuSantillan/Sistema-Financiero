import React, { useState, useEffect } from 'react'
import { 
  Search, 
  RefreshCw, 
  UserCheck, 
  UserPlus, 
  CreditCard, 
  Receipt, 
  ShieldAlert, 
  Shield, 
  Briefcase, 
  Clock, 
  Edit3 
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ModalDetalleActividad from './ModalDetalleActividad'

export default function RegistrosRecientes({ 
  onVerFichaPrestamo, 
  onAbrirCliente, 
  onAbrirInversionista,
  itemInicialId = null
}) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)

  // Estado del Modal de Detalle
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null)
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false)

  // Estados de Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroRolAutor, setFiltroRolAutor] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroPersona, setFiltroPersona] = useState('todas')
  const [ordenamiento, setOrdenamiento] = useState('recientes')

  const [personasOptions, setPersonasOptions] = useState([])

  const cargarMovimientos = async () => {
    setLoading(true)
    try {
      // 1. Cargar la tabla central de auditoría
      const { data: auditorias, error: errAud } = await supabase
        .from('auditoria_actividades')
        .select('*')
        .order('created_at', { ascending: false })

      if (errAud) console.error('Error al cargar auditoría:', errAud.message)

      const listaAuditorias = auditorias || []

      // 2. Mapear las actividades sin duplicar
      const listadoFinal = listaAuditorias.map((a) => ({
        id: `audit-${a.id}`,
        tipo: (a.tipo || 'ACTIVIDAD').toUpperCase(),
        accion: a.accion || 'REGISTRADO',
        subtitulo: a.subtitulo || 'Operación en el sistema',
        titulo: a.titulo || 'Registro',
        persona: a.persona || 'General',
        autorNombre: a.autor_nombre || 'Administración',
        autorRol: (a.autor_rol || 'admin').toLowerCase(),
        detalles: a.detalles || 'Sin detalles adicionales',
        estado: a.estado || 'Registrado',
        fechaRaw: a.created_at || new Date().toISOString(),
        rawItem: a.metadata || a
      }))

      // 3. Extraer opciones para el filtro de personas
      const setPersonas = new Set()
      listadoFinal.forEach((reg) => {
        if (reg.persona && reg.persona !== 'General') {
          setPersonas.add(reg.persona.trim())
        }
      })
      setPersonasOptions(Array.from(setPersonas).sort())

      setRegistros(listadoFinal)
    } catch (err) {
      console.error('Error al cargar auditoría:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarMovimientos()

    // Escuchar únicamente la tabla de auditoría en tiempo real
    const canalFeed = supabase
      .channel('audit-feed-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auditoria_actividades' }, () => {
        cargarMovimientos()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canalFeed)
    }
  }, [])

  // Filtrado y búsqueda
  const registrosFiltrados = registros
    .filter((reg) => {
      if (busqueda.trim() !== '') {
        const query = busqueda.toLowerCase()
        const coincideTitulo = reg.titulo.toLowerCase().includes(query)
        const coincideSubtitulo = reg.subtitulo.toLowerCase().includes(query)
        const coincideDetalles = reg.detalles.toLowerCase().includes(query)
        const coincidePersona = reg.persona?.toLowerCase().includes(query)
        const coincideAutor = reg.autorNombre?.toLowerCase().includes(query)

        if (!coincideTitulo && !coincideSubtitulo && !coincideDetalles && !coincidePersona && !coincideAutor) {
          return false
        }
      }

      if (filtroTipo !== 'todos' && reg.tipo.toLowerCase() !== filtroTipo.toLowerCase()) return false
      if (filtroRolAutor !== 'todos' && reg.autorRol.toLowerCase() !== filtroRolAutor.toLowerCase()) return false
      if (filtroEstado !== 'todos' && reg.estado.toLowerCase() !== filtroEstado.toLowerCase()) return false
      if (filtroPersona !== 'todas' && reg.persona !== filtroPersona) return false

      return true
    })
    .sort((a, b) => {
      const fechaA = new Date(a.fechaRaw)
      const fechaB = new Date(b.fechaRaw)
      return ordenamiento === 'recientes' ? fechaB - fechaA : fechaA - fechaB
    })

  const formatearFechaHoraExacta = (fechaStr) => {
    if (!fechaStr) return 'Fecha sin registrar'
    const fecha = new Date(fechaStr)
    const dia = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const anio = fecha.getFullYear()
    const horas = String(fecha.getHours()).padStart(2, '0')
    const minutos = String(fecha.getMinutes()).padStart(2, '0')
    const segundos = String(fecha.getSeconds()).padStart(2, '0')
    return `${dia}/${mes}/${anio} · ${horas}:${minutos}:${segundos} hs`
  }

  const handleCardClick = (reg) => {
    setActividadSeleccionada(reg)
    setModalDetalleOpen(true)
  }

  return (
    <section className="w-[95%] mx-auto space-y-4 my-8 select-none">
      
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#0d6b63]">
            AUDITORÍA Y TRAZABILIDAD
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
            Registro de actividades
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 bg-white px-3.5 py-2 rounded-2xl border border-line shadow-xs">
            {registrosFiltrados.length} {registrosFiltrados.length === 1 ? 'actividad' : 'actividades'}
          </span>
          <button
            onClick={cargarMovimientos}
            disabled={loading}
            title="Actualizar auditoría"
            className="p-2.5 rounded-2xl bg-white border border-line text-slate-600 hover:text-[#0d6b63] hover:border-[#0d6b63] transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0d6b63]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-line shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, monto, detalle o responsable..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-line bg-cream/40 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="w-full rounded-2xl border border-line bg-cream/30 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
          >
            <option value="todos">Todos los módulos</option>
            <option value="préstamo">Préstamos</option>
            <option value="cobro">Cobros</option>
            <option value="cliente">Clientes</option>
            <option value="inversionista">Inversionistas</option>
            <option value="admin">Administradores</option>
          </select>

          <select
            value={filtroRolAutor}
            onChange={(e) => setFiltroRolAutor(e.target.value)}
            className="w-full rounded-2xl border border-line bg-cream/30 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
          >
            <option value="todos">Cualquier Responsable</option>
            <option value="owner">Ejecutado por: Owner</option>
            <option value="admin">Ejecutado por: Admin</option>
            <option value="inversionista">Ejecutado por: Inversor</option>
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full rounded-2xl border border-line bg-cream/30 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
          >
            <option value="todos">Todos los estados</option>
            <option value="nuevo registro">Nuevo registro</option>
            <option value="activo">Activo</option>
            <option value="registrado">Registrado</option>
            <option value="perfil actualizado">Perfil Actualizado</option>
            <option value="datos actualizados">Datos Actualizados</option>
            <option value="finalizado">Finalizado</option>
          </select>

          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            className="w-full rounded-2xl border border-line bg-cream/30 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
          >
            <option value="todas">Todas las personas</option>
            {personasOptions.map((persona, i) => (
              <option key={i} value={persona}>{persona}</option>
            ))}
          </select>

          <select
            value={ordenamiento}
            onChange={(e) => setOrdenamiento(e.target.value)}
            className="w-full rounded-2xl border border-line bg-cream/30 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
          >
            <option value="recientes">Más recientes primero</option>
            <option value="antiguos">Más antiguos primero</option>
          </select>
        </div>
      </div>

      {/* Grilla de Tarjetas */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-line text-xs font-medium text-slate-400">
          Cargando libro de auditoría...
        </div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-line text-xs font-medium text-slate-400">
          No se encontraron registros de actividades.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {registrosFiltrados.map((reg) => {
            let badgeTipoColor = 'bg-slate-100 text-slate-700'
            let IconoOperacion = UserPlus

            if (reg.tipo === 'PRÉSTAMO') {
              badgeTipoColor = 'bg-[#0d6b63]/10 text-[#0d6b63] border border-[#0d6b63]/20'
              IconoOperacion = CreditCard
            } else if (reg.tipo === 'COBRO') {
              badgeTipoColor = 'bg-blue-100 text-blue-800 border border-blue-200'
              IconoOperacion = Receipt
            } else if (reg.tipo === 'INVERSIONISTA') {
              badgeTipoColor = 'bg-purple-100 text-purple-800 border border-purple-200'
              IconoOperacion = Briefcase
            } else if (reg.tipo === 'CLIENTE') {
              badgeTipoColor = 'bg-amber-100 text-amber-800 border border-amber-200'
              IconoOperacion = UserCheck
            }

            if (reg.accion === 'EDITADO') {
              IconoOperacion = Edit3
            }

            let badgeRolColor = 'bg-slate-100 text-slate-600'
            let IconoRol = Shield

            if (reg.autorRol === 'owner') {
              badgeRolColor = 'bg-rose-100 text-rose-800 font-bold border border-rose-200'
              IconoRol = ShieldAlert
            } else if (reg.autorRol === 'admin') {
              badgeRolColor = 'bg-blue-100 text-blue-800 font-bold border border-blue-200'
              IconoRol = Shield
            } else if (reg.autorRol === 'inversionista') {
              badgeRolColor = 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200'
              IconoRol = Briefcase
            }

            return (
              <div
                key={reg.id}
                onClick={() => handleCardClick(reg)}
                className="p-5 rounded-3xl bg-white border border-line shadow-xs hover:shadow-md hover:border-[#0d6b63]/40 transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${badgeTipoColor}`}>
                      <IconoOperacion className="w-3.5 h-3.5" />
                      <span>{reg.tipo} {reg.accion === 'EDITADO' ? '· EDITADO' : ''}</span>
                    </span>

                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200/60">
                      {reg.estado}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 leading-snug group-hover:text-[#0d6b63] transition-colors">
                    {reg.titulo}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {reg.subtitulo}
                  </p>

                  <p className="text-[11px] font-semibold text-slate-600 mt-2 line-clamp-2">
                    {reg.detalles}
                  </p>
                </div>

                <div className="pt-3.5 mt-3.5 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">Ejecutado por:</span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-lg flex items-center gap-1 ${badgeRolColor}`}>
                      <IconoRol className="w-3 h-3" />
                      <span>{reg.autorRol}: {reg.autorNombre}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" /> Fecha y Hora:
                    </span>
                    <span className="font-semibold text-slate-700">
                      {formatearFechaHoraExacta(reg.fechaRaw)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Detalle */}
      <ModalDetalleActividad
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        actividad={actividadSeleccionada}
        formatearFechaHoraExacta={formatearFechaHoraExacta}
      />

    </section>
  )
}