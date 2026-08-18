import React, { useState, useEffect } from 'react'
import { User, Briefcase, X, Users, ChevronDown } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

import ModalEditarInversionista from './ModalEditarInversionista'
import ModalEditarCliente from './ModalEditarCliente'
import FichaInversionista from './FichaInversionista'
import FichaCliente from './FichaCliente'
import ListaLateralClientes from './ListaLateralClientes'

export default function ModalDirectorio({ 
  isOpen, 
  onClose, 
  tipoInicial = 'clientes', 
  itemInicialId = null, 
  onVerFichaPrestamo,
  usuarioLogueado = null,
  rolUsuario = "admin"
}) {
  const rolReal = usuarioLogueado?.rol || rolUsuario
  const esInversionista = rolReal === 'inversionista'

  const [tipo, setTipo] = useState(esInversionista ? 'clientes' : tipoInicial)
  const [busqueda, setBusqueda] = useState('')
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(false)

  const [listaInversionistas, setListaInversionistas] = useState([])
  const [inversionistaSeleccionado, setInversionistaSeleccionado] = useState(null)
  const [menuInversionistasAbierto, setMenuInversionistasAbierto] = useState(false)

  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [modalEditarClienteOpen, setModalEditarClienteOpen] = useState(false)

  const [itemSeleccionado, setItemSeleccionado] = useState(null)
  const [referidoInfo, setReferidoInfo] = useState(null)
  const [prestamos, setPrestamos] = useState([])
  const [pagos, setPagos] = useState([])
  const [clientesRelacionados, setClientesRelacionados] = useState([])
  const [fetchingDetalle, setFetchingDetalle] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTipo(esInversionista ? 'clientes' : tipoInicial)
      setBusqueda('')
      setItemSeleccionado(null)
      setInversionistaSeleccionado(null)
      setMenuInversionistasAbierto(false)
      setReferidoInfo(null)
      setLista([])
      setPrestamos([])
      setPagos([])
      setClientesRelacionados([])
    }
  }, [isOpen, tipoInicial, esInversionista])

  useEffect(() => {
    if (!isOpen) return
    let isMounted = true

    async function fetchData() {
      setLoading(true)
      try {
        if (tipo === 'clientes') {
          let listaData = []

          if (esInversionista && usuarioLogueado?.id) {
            const invId = usuarioLogueado.id
            const { data: prestamosInversor } = await supabase
              .from('prestamos')
              .select('cliente_id')
              .eq('inversionista_id', invId)

            const clienteIds = [...new Set((prestamosInversor || []).map((p) => p.cliente_id))].filter(Boolean)
            let queryInversor = supabase.from('clientes').select('*')

            if (clienteIds.length > 0) {
              queryInversor = queryInversor.or(`inversionista_id.eq.${invId},id.in.(${clienteIds.join(',')})`)
            } else {
              queryInversor = queryInversor.eq('inversionista_id', invId)
            }

            queryInversor = queryInversor.order('nombre_completo', { ascending: true })
            if (busqueda.trim() !== '') queryInversor = queryInversor.ilike('nombre_completo', `%${busqueda}%`)

            const { data, error } = await queryInversor
            if (error) throw error
            listaData = data || []
          } else {
            let query = supabase.from('clientes').select('*').order('nombre_completo', { ascending: true })
            if (busqueda.trim() !== '') query = query.ilike('nombre_completo', `%${busqueda}%`)

            const { data, error } = await query
            if (error) throw error
            listaData = data || []
          }

          if (isMounted) {
            setLista(listaData)
            if (listaData.length > 0) {
              const idABuscar = itemSeleccionado?.id || itemInicialId
              const itemEspecifico = idABuscar ? listaData.find((el) => el.id === idABuscar) : null
              const perfilASeleccionar = itemEspecifico || listaData[0]
              cargarDetallePerfil(perfilASeleccionar, 'clientes')
            } else {
              setItemSeleccionado(null)
            }
          }
        } else {
          const { data: invs, error: errInv } = await supabase
            .from('usuarios')
            .select('*')
            .eq('rol', 'inversionista')
            .order('nombre_completo', { ascending: true })

          if (errInv) throw errInv
          if (isMounted) {
            const listaInvs = invs || []
            setListaInversionistas(listaInvs)
            if (listaInvs.length > 0) {
              const invInicial = itemInicialId ? listaInvs.find((el) => el.id === itemInicialId) : listaInvs[0]
              setInversionistaSeleccionado(invInicial || listaInvs[0])
            }
          }
        }
      } catch (err) {
        console.error(`Error al cargar datos del directorio (${tipo}):`, err)
        if (isMounted) setLista([])
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => { isMounted = false }
  }, [tipo, busqueda, isOpen, esInversionista, usuarioLogueado?.id])

  useEffect(() => {
    if (tipo !== 'inversionistas' || !inversionistaSeleccionado || esInversionista) return
    let isMounted = true

    async function cargarClientesDelInversionista() {
      setLoading(true)
      try {
        const invId = inversionistaSeleccionado.id
        const { data: prestamosData } = await supabase
          .from('prestamos')
          .select('*')
          .eq('inversionista_id', invId)
          .order('fecha_inicio', { ascending: false })

        const prestamosFinales = prestamosData || []
        if (isMounted) setPrestamos(prestamosFinales)

        const clienteIdsDePrestamos = [...new Set(prestamosFinales.map((p) => p.cliente_id))].filter(Boolean)
        let queryClientes = supabase.from('clientes').select('*')

        if (clienteIdsDePrestamos.length > 0) {
          queryClientes = queryClientes.or(`inversionista_id.eq.${invId},id.in.(${clienteIdsDePrestamos.join(',')})`)
        } else {
          queryClientes = queryClientes.eq('inversionista_id', invId)
        }

        queryClientes = queryClientes.order('nombre_completo', { ascending: true })
        if (busqueda.trim() !== '') queryClientes = queryClientes.ilike('nombre_completo', `%${busqueda}%`)

        const { data: clientesData, error: errC } = await queryClientes
        if (errC) throw errC

        if (isMounted) {
          const resultado = clientesData || []
          setClientesRelacionados(resultado)
          setLista(resultado)
        }
      } catch (err) {
        console.error('Error al cargar clientes del inversionista:', err)
        if (isMounted) {
          setClientesRelacionados([])
          setLista([])
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    cargarClientesDelInversionista()
    return () => { isMounted = false }
  }, [inversionistaSeleccionado, tipo, busqueda, esInversionista])

  const cargarDetallePerfil = async (item, tipoActual) => {
    if (!item) return
    setItemSeleccionado(item)
    setFetchingDetalle(true)
    setReferidoInfo(null)
    setPrestamos([])
    setPagos([])

    try {
      if (tipoActual === 'clientes') {
        const { data: prestamosData } = await supabase
          .from('prestamos')
          .select('*')
          .eq('cliente_id', item.id)
          .order('fecha_inicio', { ascending: false })

        const prestamosFinales = prestamosData || []
        setPrestamos(prestamosFinales)

        const { data: pagosData } = await supabase
          .from('pagos')
          .select('*, clientes(nombre_completo)')
          .eq('cliente_id', item.id)
          .order('fecha_pago', { ascending: false })

        setPagos(pagosData || [])

        let idInversionista = item.inversionista_id || item.usuario_id
        if (!idInversionista && prestamosFinales.length > 0) {
          const prestamoConInv = prestamosFinales.find((p) => p.inversionista_id)
          if (prestamoConInv) idInversionista = prestamoConInv.inversionista_id
        }

        if (idInversionista) {
          const { data: invData } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', idInversionista)
            .maybeSingle()

          const nombreMostrar = invData?.nombre || invData?.nombre_completo || invData?.email
          setReferidoInfo(nombreMostrar ? `Inversionista (${nombreMostrar})` : 'Inversionista asignado')
        } else {
          setReferidoInfo('Propio (Administrador)')
        }
      }
    } catch (err) {
      console.error('Error al cargar detalle:', err)
      setReferidoInfo('Propio (Administrador)')
    } finally {
      setFetchingDetalle(false)
    }
  }

  const handleIrAPerfilCliente = (cliente) => {
    if (!cliente) return
    setItemSeleccionado(cliente)
    setTipo('clientes')
    cargarDetallePerfil(cliente, 'clientes')
  }

  const handleToggleEstado = async (targetItem, tablaNombre) => {
    if (!targetItem) return
    setActionLoading(true)
    const nuevoEstado = !(targetItem.activo ?? true)

    try {
      const { error } = await supabase
        .from(tablaNombre)
        .update({ activo: nuevoEstado })
        .eq('id', targetItem.id)

      if (error) throw error

      if (tablaNombre === 'usuarios') {
        setInversionistaSeleccionado((prev) => ({ ...prev, activo: nuevoEstado }))
        setListaInversionistas((prev) => prev.map((inv) => inv.id === targetItem.id ? { ...inv, activo: nuevoEstado } : inv))
      } else {
        const itemActualizado = { ...targetItem, activo: nuevoEstado }
        setItemSeleccionado(itemActualizado)
        setLista((prev) => prev.map((e) => (e.id === targetItem.id ? itemActualizado : e)))
      }
    } catch (err) {
      console.error('Error al cambiar estado:', err)
      alert(`Error al actualizar en la DB: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const formatearFecha = (fechaRaw) => {
    if (!fechaRaw) return ''
    const fecha = fechaRaw.split('T')[0]
    const [year, month, day] = fecha.split('-')
    return `${day}/${month}/${year}`
  }

  if (!isOpen) return null

  const soloInversionistas = listaInversionistas.filter((inv) => inv.rol === 'inversionista')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none">
      <div className="w-full max-w-5xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line h-[88vh] flex flex-col overflow-hidden">
        
        {/* CABECERA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line shrink-0">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939]">
              {esInversionista 
                ? 'Mis Clientes Asociados' 
                : 'Información General'}
            </h2>
          </div>

          {/* Menú Desplegable Inversionistas */}
          {tipo === 'inversionistas' && !esInversionista && (
            <div className="relative">
              <button
                onClick={() => setMenuInversionistasAbierto(!menuInversionistasAbierto)}
                className="flex gap-2 px-3 py-2.5 rounded-xl bg-[#0d6b63] text-white text-xs font-bold shadow-xs hover:bg-[#0b5a52] transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Inversionistas ({soloInversionistas.length})</span>
                <ChevronDown className="w-4 h-4 ml-1" />
              </button>

              {menuInversionistasAbierto && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-line shadow-2xl z-50 max-h-64 overflow-y-auto p-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 px-3 py-1 block border-b border-line mb-1">
                    Seleccionar Inversionista
                  </span>
                  {soloInversionistas.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center font-medium">
                      No hay inversionistas registrados
                    </div>
                  ) : (
                    soloInversionistas.map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => {
                          setInversionistaSeleccionado(inv)
                          setMenuInversionistasAbierto(false)
                        }}
                        className={`p-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
                          inversionistaSeleccionado?.id === inv.id
                            ? 'bg-[#0d6b63]/10 text-[#0d6b63]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{inv.nombre_completo || inv.nombre}</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          Tel: {inv.telefono || 's/d'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Toggle de Pestañas */}
          <div className="flex items-center gap-2 bg-white/80 p-1.5 rounded-2xl border border-line">
            <button
              onClick={() => setTipo('clientes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tipo === 'clientes' ? 'bg-[#0d6b63] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Clientes</span>
            </button>

            {!esInversionista && (
              <button
                onClick={() => setTipo('inversionistas')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tipo === 'inversionistas' ? 'bg-[#0d6b63] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Inversionistas</span>
              </button>
            )}

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        {tipo === 'inversionistas' && !esInversionista ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 flex-1 overflow-hidden">
            <div className="md:col-span-8 h-full overflow-hidden">
              <FichaInversionista
                inversionista={inversionistaSeleccionado}
                prestamos={prestamos}
                clientesRelacionados={clientesRelacionados}
                esInversionista={esInversionista}
                actionLoading={actionLoading}
                onEditar={() => setModalEditarOpen(true)}
                onToggleEstado={() => handleToggleEstado(inversionistaSeleccionado, 'usuarios')}
                onVerFichaPrestamo={onVerFichaPrestamo}
              />
            </div>
            <div className="md:col-span-4 h-full overflow-hidden">
              <ListaLateralClientes
                lista={lista}
                busqueda={busqueda}
                loading={loading}
                placeholderBusqueda="Buscar cliente financiado..."
                mensajeVacio="Sin clientes asignados a este inversor."
                tituloHeader="CLIENTES FINANCIADOS"
                mostrarBordeDerecho={false}
                onSeleccionarItem={handleIrAPerfilCliente}
                onCambiarBusqueda={setBusqueda}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 flex-1 overflow-hidden">
            <div className="md:col-span-4 h-full overflow-hidden">
              <ListaLateralClientes
                lista={lista}
                itemSeleccionado={itemSeleccionado}
                busqueda={busqueda}
                loading={loading}
                placeholderBusqueda="Buscar clientes..."
                mensajeVacio={esInversionista ? 'No posees clientes asociados.' : 'No hay clientes registrados.'}
                mostrarBordeDerecho={true}
                onSeleccionarItem={(item) => cargarDetallePerfil(item, 'clientes')}
                onCambiarBusqueda={setBusqueda}
              />
            </div>
            <div className="md:col-span-8 h-full overflow-hidden">
              <FichaCliente
                cliente={itemSeleccionado}
                fetchingDetalle={fetchingDetalle}
                referidoInfo={referidoInfo}
                prestamos={prestamos}
                pagos={pagos}
                esInversionista={esInversionista}
                actionLoading={actionLoading}
                formatearFecha={formatearFecha}
                onEditar={() => setModalEditarClienteOpen(true)}
                onToggleEstado={() => handleToggleEstado(itemSeleccionado, 'clientes')}
                onVerFichaPrestamo={onVerFichaPrestamo}
              />
            </div>
          </div>
        )}

        {/* Modales de Edición */}
        <ModalEditarInversionista
          isOpen={modalEditarOpen}
          onClose={() => setModalEditarOpen(false)}
          inversionista={inversionistaSeleccionado}
          onSuccess={(inversionistaActualizado) => {
            setInversionistaSeleccionado(inversionistaActualizado)
            setListaInversionistas((prev) => prev.map((inv) => inv.id === inversionistaActualizado.id ? inversionistaActualizado : inv))
          }}
        />

        <ModalEditarCliente
          isOpen={modalEditarClienteOpen}
          onClose={() => setModalEditarClienteOpen(false)}
          cliente={itemSeleccionado}
          onSuccess={(clienteActualizado) => {
            setItemSeleccionado(clienteActualizado)
            setLista((prev) => prev.map((c) => c.id === clienteActualizado.id ? clienteActualizado : c))
          }}
        />

      </div>
    </div>
  )
}