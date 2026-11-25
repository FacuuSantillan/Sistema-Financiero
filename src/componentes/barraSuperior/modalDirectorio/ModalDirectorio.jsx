import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

import ModalEditarCliente from './ModalEditarCliente'
import FichaCliente from './FichaCliente'
import ListaLateralClientes from './ListaLateralClientes'

export default function ModalDirectorio({
  isOpen,
  onClose,
  itemInicialId = null,
  onVerFichaPrestamo,
  usuarioLogueado = null,
  rolUsuario = 'admin'
}) {
  const rolReal = usuarioLogueado?.rol || rolUsuario
  // Usuarios con rol "inversionista" (heredados) solo ven sus propios clientes
  const esInversionista = rolReal === 'inversionista'

  const [busqueda, setBusqueda] = useState('')
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalEditarClienteOpen, setModalEditarClienteOpen] = useState(false)

  const [itemSeleccionado, setItemSeleccionado] = useState(null)
  const [prestamos, setPrestamos] = useState([])
  const [fetchingDetalle, setFetchingDetalle] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // En celular se ve una cosa por vez: la lista o la ficha del cliente
  const [vistaMovil, setVistaMovil] = useState('lista')

  // Cliente seleccionado actual, accesible desde el efecto sin re-dispararlo
  const seleccionRef = useRef(null)
  useEffect(() => { seleccionRef.current = itemSeleccionado }, [itemSeleccionado])

  const cargarDetallePerfil = useCallback(async (item) => {
    if (!item) return
    setItemSeleccionado(item)
    setFetchingDetalle(true)
    setPrestamos([])

    try {
      const { data: prestamosData, error } = await supabase
        .from('prestamos')
        .select('*')
        .eq('cliente_id', item.id)
        .order('fecha_inicio', { ascending: false })

      if (error) throw error
      setPrestamos(prestamosData || [])
    } catch (err) {
      console.error('Error al cargar detalle:', err)
    } finally {
      setFetchingDetalle(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    seleccionRef.current = null
    setVistaMovil(itemInicialId ? 'ficha' : 'lista')
    setBusqueda('')
    setItemSeleccionado(null)
    setLista([])
    setPrestamos([])
  }, [isOpen, itemInicialId])

  useEffect(() => {
    if (!isOpen) return
    let isMounted = true

    async function fetchData() {
      setLoading(true)
      try {
        let query = supabase.from('clientes').select('*').order('nombre_completo', { ascending: true })

        if (esInversionista && usuarioLogueado?.id) {
          const invId = usuarioLogueado.id
          const { data: prestamosInversor } = await supabase.from('prestamos').select('cliente_id').eq('inversionista_id', invId)
          const clienteIds = [...new Set((prestamosInversor || []).map((p) => p.cliente_id))].filter(Boolean)
          query = clienteIds.length > 0
            ? query.or(`inversionista_id.eq.${invId},id.in.(${clienteIds.join(',')})`)
            : query.eq('inversionista_id', invId)
        }

        // Búsqueda por nombre o número de documento
        const texto = busqueda.trim().replace(/[,()%*]/g, ' ').trim()
        if (texto) query = query.or(`nombre_completo.ilike.%${texto}%,dni.ilike.%${texto}%`)

        const { data, error } = await query
        if (error) throw error
        if (!isMounted) return

        const listaData = data || []
        setLista(listaData)

        if (listaData.length > 0) {
          const actual = seleccionRef.current
          const idABuscar = actual?.id || itemInicialId
          const elegido = (idABuscar && listaData.find((el) => el.id === idABuscar)) || listaData[0]
          if (elegido.id !== actual?.id) cargarDetallePerfil(elegido)
        } else {
          setItemSeleccionado(null)
        }
      } catch (err) {
        console.error('Error al cargar clientes:', err)
        if (isMounted) setLista([])
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => { isMounted = false }
  }, [busqueda, isOpen, esInversionista, usuarioLogueado?.id, itemInicialId, cargarDetallePerfil])

  const handleToggleEstado = async (targetItem) => {
    if (!targetItem) return
    setActionLoading(true)
    const nuevoEstado = !(targetItem.activo ?? true)

    try {
      const { error } = await supabase.from('clientes').update({ activo: nuevoEstado }).eq('id', targetItem.id)
      if (error) throw error

      const itemActualizado = { ...targetItem, activo: nuevoEstado }
      setItemSeleccionado(itemActualizado)
      setLista((prev) => prev.map((e) => (e.id === targetItem.id ? itemActualizado : e)))
    } catch (err) {
      console.error('Error al cambiar estado:', err)
      window.alert(`Error al actualizar en la base de datos: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="modal-panel w-full max-w-5xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line modal-panel-full h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-line shrink-0">
          {/* En celular, con la ficha abierta, el título se convierte en "volver a la lista" */}
          {vistaMovil === 'ficha' && (
            <button
              onClick={() => setVistaMovil('lista')}
              className="md:hidden flex items-center gap-1.5 -ml-1 px-2 py-2 rounded-xl text-sm font-bold text-[#0d6b63] active:bg-[#0d6b63]/10 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" /> Clientes
            </button>
          )}
          <h2 className={`text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] ${vistaMovil === 'ficha' ? 'max-md:hidden' : ''}`}>
            {esInversionista ? 'Mis Clientes' : 'Clientes'}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 flex-1 overflow-hidden">
          <div className={`md:col-span-4 h-full overflow-hidden ${vistaMovil === 'ficha' ? 'max-md:hidden' : ''}`}>
            <ListaLateralClientes
              lista={lista}
              itemSeleccionado={itemSeleccionado}
              busqueda={busqueda}
              loading={loading}
              placeholderBusqueda="Buscar por nombre o documento..."
              mensajeVacio="No hay clientes registrados."
              mostrarBordeDerecho={true}
              onSeleccionarItem={(item) => {
                cargarDetallePerfil(item)
                setVistaMovil('ficha')
              }}
              onCambiarBusqueda={setBusqueda}
            />
          </div>
          <div className={`md:col-span-8 h-full overflow-hidden ${vistaMovil === 'lista' ? 'max-md:hidden' : ''}`}>
            <FichaCliente
              cliente={itemSeleccionado}
              fetchingDetalle={fetchingDetalle}
              prestamos={prestamos}
              esInversionista={esInversionista}
              actionLoading={actionLoading}
              usuarioLogueado={usuarioLogueado}
              onEditar={() => setModalEditarClienteOpen(true)}
              onToggleEstado={() => handleToggleEstado(itemSeleccionado)}
              onVerFichaPrestamo={onVerFichaPrestamo}
              onSuccess={(idBorrado) => {
                setLista((prev) => prev.filter((c) => c.id !== idBorrado))
                setItemSeleccionado(null)
                setVistaMovil('lista')
              }}
            />
          </div>
        </div>

        <ModalEditarCliente
          isOpen={modalEditarClienteOpen}
          onClose={() => setModalEditarClienteOpen(false)}
          cliente={itemSeleccionado}
          usuarioLogueado={usuarioLogueado}
          onSuccess={(clienteActualizado) => {
            setItemSeleccionado(clienteActualizado)
            setLista((prev) => prev.map((c) => (c.id === clienteActualizado.id ? clienteActualizado : c)))
          }}
        />
      </div>
    </div>
  )
}
