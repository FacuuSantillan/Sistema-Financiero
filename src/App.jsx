import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { LogOut, Users, CalendarClock, ReceiptText, BadgePercent } from 'lucide-react'
import { supabase } from './lib/supabaseClient'

// Autenticación
import Login from './componentes/auth/Login'

// Componentes del Dashboard
import BarraSuperior from './componentes/barraSuperior/barraSuperior'
import ModalCliente from './componentes/botonesDeAccion/ModalesBotones/ModalClientes'
import ModalAgregarOpcionPrestamo from './componentes/botonesDeAccion/ModalesBotones/ModalAgregarOpcionPrestamo'
import ModalAgregarPrestamo from './componentes/botonesDeAccion/ModalesBotones/ModalAgregarPrestamo'
import ModalPago from './componentes/botonesDeAccion/ModalesBotones/ModalAgregarPago'
import ModalDirectorio from './componentes/barraSuperior/modalDirectorio/ModalDirectorio'
import BotonesDeAccion from './componentes/botonesDeAccion/BotonesDeAccion'
import ModalFichaPrestamo from './componentes/botonesDeAccion/ModalesBotones/ModalFichaPrestamo'
import PanoramaEstadisticas from './componentes/PanoramaEstadisticas/PanoramaEstadisticas'
import ModalAdmin from './componentes/botonesDeAccion/ModalesBotones/ModalAdmin'
import ModalCobranzas from './componentes/Cobranzas/ModalCobranzas'
import Avisos from './componentes/comunes/Avisos'

// Carga diferida: el gráfico (recharts) y el registro de actividades son pesados
// y solo los ven admin/owner. Se descargan recién cuando hacen falta.
const GraficoEstadistico = lazy(() => import('./componentes/PanoramaEstadisticas/GraficoEstadistico'))
const RegistrosRecientes = lazy(() => import('./componentes/Registros/RegistrosRecientes'))

const CargandoSeccion = () => (
  <div className="w-[95%] mx-auto my-6 h-40 rounded-3xl bg-white/60 border border-line animate-pulse" />
)

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [avisoLogin, setAvisoLogin] = useState('')

  const [prestamoFicha, setPrestamoFicha] = useState(null)
  const [modalActivo, setModalActivo] = useState(null)
  const [versionCobros, setVersionCobros] = useState(0)
  const [perfilSeleccionadoId, setPerfilSeleccionadoId] = useState(null)
  const [modalFichaAbierta, setModalFichaAbierta] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // FUNCIÓN PARA REDIMENSIONAR LA VENTANA NATIVA DE TAURI
  const redimensionarVentana = useCallback(async (esDashboard) => {
    try {
      if (window.__TAURI__?.window) {
        const appWindow = window.__TAURI__.window.getCurrentWindow()
        if (esDashboard) {
          await appWindow.setSize({ type: 'Logical', width: 1280, height: 800 })
          await appWindow.center()
        } else {
          await appWindow.setSize({ type: 'Logical', width: 750, height: 500 })
          await appWindow.center()
        }
      }
    } catch (err) {
      console.warn('No se pudo redimensionar la ventana:', err)
    }
  }, [])

  // Carga completa del perfil del usuario
  const cargarPerfilUsuario = useCallback(async (sessionUser) => {
    if (!sessionUser) {
      setUsuario(null)
      redimensionarVentana(false)
      return
    }

    // No se deja entrar sin un perfil válido: antes se asignaba el rol
    // "inversionista" en silencio y el owner/admin no veía sus pantallas.
    const rechazarIngreso = (mensaje) => {
      // Diferido: llamar a auth dentro de onAuthStateChange puede bloquear supabase-js
      setTimeout(() => supabase.auth.signOut(), 0)
      setUsuario(null)
      setAvisoLogin(mensaje)
      redimensionarVentana(false)
    }

    try {
      const { data: profile, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle()

      if (error) {
        console.error('Error al cargar perfil:', error)
        rechazarIngreso(
          error.code === '42501'
            ? 'La base de datos no da permisos de lectura. Ejecutá db/schema.sql en Supabase (sección 2: permisos).'
            : `No se pudo cargar tu perfil: ${error.message}`
        )
        return
      }

      if (!profile) {
        rechazarIngreso('Tu usuario no tiene un perfil asignado en el sistema. Pedile al owner que lo cree (sección 5 de db/schema.sql).')
        return
      }

      // Un usuario desactivado no puede ingresar al sistema
      if (profile.activo === false) {
        rechazarIngreso('Tu cuenta está desactivada. Contactá al administrador.')
        return
      }

      setAvisoLogin('')
      setUsuario({
        ...sessionUser,
        rol: profile.rol || 'admin',
        nombre: profile.nombre_completo || sessionUser.email
      })
      redimensionarVentana(true)
    } catch (error) {
      console.error('Error al cargar perfil:', error)
      rechazarIngreso('No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.')
    }
  }, [redimensionarVentana])

  useEffect(() => {
    // 1. Obtener sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await cargarPerfilUsuario(session.user)
      } else {
        redimensionarVentana(false)
      }
      setCheckingAuth(false)
    })

    // 2. Escuchar cambios de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await cargarPerfilUsuario(session.user)
      } else {
        setUsuario(null)
        redimensionarVentana(false)
      }
      setCheckingAuth(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [cargarPerfilUsuario, redimensionarVentana])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
    redimensionarVentana(false)
  }

  const handleRefreshData = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleAbrirFichaPrestamo = (prestamo) => {
    setPrestamoFicha(prestamo)
    setModalFichaAbierta(true)
  }

  const handleOpenDirectorioClientes = () => {
    setPerfilSeleccionadoId(null)
    setModalActivo('directorio')
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center text-xs font-bold text-slate-400 space-y-2">
        <div className="w-8 h-8 border-3 border-[#0d6b63] border-t-transparent rounded-full animate-spin" />
        <span>Cargando...</span>
      </div>
    )
  }

  if (!usuario) {
    return <Login key={avisoLogin} avisoInicial={avisoLogin} onLoginSuccess={(u) => cargarPerfilUsuario(u)} />
  }

  const esAdmin = usuario.rol === 'admin' || usuario.rol === 'owner'

  return (
    <>
    {/* Fuera del bloque que se re-monta al refrescar datos, para que los avisos no se pierdan */}
    <Avisos />
    <div key={`${usuario.id}-${usuario.rol}-${refreshKey}`} className="min-h-screen bg-paper pb-28 sm:pb-12 safe-pt safe-px">
      {/* Barra de usuario y Logout */}
      <div className="w-[95%] mx-auto pt-3 flex items-center justify-between gap-3 text-xs font-medium text-slate-600 border-b border-line/60 pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-800 truncate">{usuario.nombre}</span>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              esAdmin ? 'bg-[#0d6b63]/10 text-[#0d6b63]' : 'bg-blue-100 text-blue-800'
            }`}
          >
            {usuario.rol}
          </span>
        </div>

        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="shrink-0 flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] sm:min-h-0 px-3 py-1 rounded-xl bg-white border border-line text-slate-600 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer font-bold shadow-2xs"
        >
          <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Cerrar Sesión</span>
        </button>
      </div>

      <BarraSuperior rolUsuario={usuario?.rol} />

      <BotonesDeAccion
        rolUsuario={usuario?.rol}
        onOpenModal={(tipo) => setModalActivo(tipo)}
        onOpenClientes={handleOpenDirectorioClientes}
        onOpenCobranzas={() => setModalActivo('cobranzas')}
      />

      {/* Modales */}
      <ModalAdmin
        rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'admin'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}
        usuarioLogueado={usuario}
      />

      <ModalCliente
        rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'cliente'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}
        usuarioLogueado={usuario}
      />

      <ModalAgregarOpcionPrestamo
        rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'opcionPrestamo'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}
      />

      <ModalAgregarPrestamo
        rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'prestamo'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}
        usuarioLogueado={usuario}
      />

      <ModalPago
        rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'pago'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}
        usuarioLogueado={usuario}
      />

      <ModalCobranzas
        isOpen={modalActivo === 'cobranzas'}
        version={versionCobros}
        onClose={() => setModalActivo(null)}
        onVerFichaPrestamo={handleAbrirFichaPrestamo}
      />

      <ModalDirectorio
        rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'directorio'}
        itemInicialId={perfilSeleccionadoId}
        usuarioLogueado={usuario}
        onClose={() => {
          setModalActivo(null)
          setPerfilSeleccionadoId(null)
        }}
        onVerFichaPrestamo={handleAbrirFichaPrestamo}
      />

      <ModalFichaPrestamo
        rolUsuario={usuario?.rol}
        isOpen={modalFichaAbierta}
        onClose={() => {
          setModalFichaAbierta(false)
          setPrestamoFicha(null)
        }}
        prestamo={prestamoFicha}
        usuarioLogueado={usuario}
        onCobroRegistrado={() => setVersionCobros((v) => v + 1)}
        onPrestamoEliminado={() => {
          setVersionCobros((v) => v + 1)
          // Refresca listados (ficha del cliente, estadísticas) sin el préstamo borrado
          handleRefreshData()
        }}
      />

      {/* Métricas y Estadísticas */}
      {esAdmin && (
        <>
          <PanoramaEstadisticas rolUsuario={usuario?.rol} />
          <Suspense fallback={<CargandoSeccion />}>
            <GraficoEstadistico />
          </Suspense>
        </>
      )}

      {/* Registros Recientes */}
      {usuario?.rol === 'owner' && (
        <Suspense fallback={<CargandoSeccion />}>
          <RegistrosRecientes
            rolUsuario={usuario?.rol}
            onVerFichaPrestamo={handleAbrirFichaPrestamo}
            onAbrirCliente={(cliente) => {
              setPerfilSeleccionadoId(cliente?.id || null)
              setModalActivo('directorio')
            }}
          />
        </Suspense>
      )}

      {/* Barra inferior de accesos rápidos (solo celular) */}
      <nav
        aria-label="Accesos rápidos"
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line shadow-[0_-4px_16px_rgba(0,0,0,0.06)] safe-pb safe-px"
      >
        <div className="grid grid-flow-col auto-cols-fr">
          {[
            { id: 'directorio', label: 'Clientes', icon: Users, onClick: handleOpenDirectorioClientes, visible: true },
            { id: 'cobranzas', label: 'Cuotas', icon: CalendarClock, onClick: () => setModalActivo('cobranzas'), visible: esAdmin },
            { id: 'pago', label: 'Cobrar', icon: ReceiptText, onClick: () => setModalActivo('pago'), visible: true },
            { id: 'prestamo', label: 'Préstamo', icon: BadgePercent, onClick: () => setModalActivo('prestamo'), visible: esAdmin }
          ]
            .filter((b) => b.visible)
            .map((b) => {
              const Icono = b.icon
              const activo = modalActivo === b.id
              return (
                <button
                  key={b.id}
                  onClick={b.onClick}
                  aria-current={activo ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-bold cursor-pointer ${
                    activo ? 'text-[#0d6b63]' : 'text-slate-500 active:text-[#0d6b63]'
                  }`}
                >
                  <Icono className="w-6 h-6" />
                  {b.label}
                </button>
              )
            })}
        </div>
      </nav>
    </div>
    </>
  )
}