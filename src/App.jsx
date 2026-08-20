import React, { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from './lib/supabaseClient'


// Autenticación
import Login from './componentes/auth/Login'

// Componentes del Dashboard
import BarraSuperior from './componentes/barraSuperior/barraSuperior'
import ModalInversionista from './componentes/botonesDeAccion/ModalesBotones/ModalInversionista'
import ModalCliente from './componentes/botonesDeAccion/ModalesBotones/ModalClientes'
import ModalAgregarOpcionPrestamo from './componentes/botonesDeAccion/ModalesBotones/ModalAgregarOpcionPrestamo'
import ModalAgregarPrestamo from './componentes/botonesDeAccion/ModalesBotones/ModalAgregarPrestamo'
import ModalPago from './componentes/botonesDeAccion/ModalesBotones/ModalAgregarPago'
import ModalDirectorio from './componentes/barraSuperior/modalDirectorio/ModalDirectorio'
import BotonesDeAccion from './componentes/botonesDeAccion/BotonesDeAccion'
import ModalFichaPrestamo from './componentes/botonesDeAccion/ModalesBotones/ModalFichaPrestamo'
import PanoramaEstadisticas from './componentes/PanoramaEstadisticas/PanoramaEstadisticas'
import ModalAdmin from './componentes/botonesDeAccion/ModalesBotones/ModalAdmin'
import RegistrosRecientes from './componentes/Registros/RegistrosRecientes'
import ModalEditarInversionista from './componentes/barraSuperior/modalDirectorio/ModalEditarInversionista'
import GraficoEstadistico from './componentes/PanoramaEstadisticas/GraficoEstadistico'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [prestamoFicha, setPrestamoFicha] = useState(null)
  const [modalActivo, setModalActivo] = useState(null)
  const [tipoDirectorio, setTipoDirectorio] = useState('clientes')
  const [perfilSeleccionadoId, setPerfilSeleccionadoId] = useState(null)
  const [modalFichaAbierta, setModalFichaAbierta] = useState(false)

  // 🔴 FUNCIÓN PARA REDIMENSIONAR LA VENTANA NATIVA DE TAURI
const redimensionarVentana = async (esDashboard) => {
  try {
    // Si la app está corriendo dentro del entorno de Tauri
    if (window.__TAURI__?.window) {
      const appWindow = window.__TAURI__.window.getCurrentWindow();
      if (esDashboard) {
        await appWindow.setSize({ type: 'Logical', width: 1280, height: 800 });
        await appWindow.center();
      } else {
        await appWindow.setSize({ type: 'Logical', width: 750, height: 500 });
        await appWindow.center();
      }
    }
  } catch (err) {
    console.warn("No se pudo redimensionar la ventana:", err);
  }
};

  // Verificar sesión y ajustar tamaño de ventana
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          const { data: profile } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          const userObj = {
            ...session.user,
            rol: profile?.rol || (session.user.email?.includes('admin') ? 'admin' : 'inversionista'),
            nombre: profile?.nombre_completo || profile?.nombre || session.user.email
          }
          setUsuario(userObj)
          redimensionarVentana(true) // Expandir ventana
        } else {
          redimensionarVentana(false) // Achicar ventana para Login
        }
      } catch (err) {
        console.error('Error al verificar sesión:', err)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        setUsuario({
          ...session.user,
          rol: profile?.rol || (session.user.email?.includes('admin') ? 'admin' : 'inversionista'),
          nombre: profile?.nombre_completo || profile?.nombre || session.user.email
        })
        redimensionarVentana(true) // Expandir
      } else {
        setUsuario(null)
        redimensionarVentana(false) // Achicar
      }
      setCheckingAuth(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
    redimensionarVentana(false)
  }

  const handleRefreshData = () => {
    console.log('Registro creado con éxito. Recargando datos...')
  }

  const handleAbrirFichaPrestamo = (prestamo) => {
    setPrestamoFicha(prestamo)
    setModalFichaAbierta(true)
  }

  const handleOpenDirectorioClientes = () => {
    setTipoDirectorio('clientes')
    setPerfilSeleccionadoId(null)
    setModalActivo('directorio')
  }

  const handleOpenDirectorioInversionistas = () => {
    setTipoDirectorio('inversionistas')
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
    return <Login onLoginSuccess={(u) => setUsuario(u)} />
  }

  const esAdmin = usuario.rol === 'admin' || usuario.rol === 'owner'

  return (
    <div className="min-h-screen bg-paper pb-12">
      <div className="w-[95%] mx-auto pt-3 flex items-center justify-between text-xs font-medium text-slate-600 border-b border-line/60 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-800">{usuario.nombre}</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            esAdmin ? 'bg-[#0d6b63]/10 text-[#0d6b63]' : 'bg-blue-100 text-blue-800'
          }`}>
            {usuario.rol}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-line text-slate-600 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer font-bold shadow-2xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      <BarraSuperior 
      rolUsuario={usuario?.rol}/>

      <BotonesDeAccion
      rolUsuario={usuario?.rol} 
        onOpenModal={(tipo) => setModalActivo(tipo)}
        onOpenClientes={handleOpenDirectorioClientes}
        onOpenInversionistas={handleOpenDirectorioInversionistas}
        rolUsuario={usuario?.rol}
      />

      <ModalInversionista
      rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'inversionista'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}

      />

     

      <ModalAdmin
      rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'admin'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}
      />

      <ModalCliente
      rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'cliente'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}
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
      />

      <ModalPago
      rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'pago'}
        onClose={() => setModalActivo(null)}
        onSuccess={handleRefreshData}
        usuarioLogueado={usuario} 
      />

      <ModalDirectorio
        rolUsuario={usuario?.rol}
        isOpen={modalActivo === 'directorio'}
        tipoInicial={tipoDirectorio}
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
      />


        {(usuario?.rol === 'owner' || usuario?.rol === 'admin') && (
          <>
          <PanoramaEstadisticas 
            onAbrirDirectorioInversionistas={handleOpenDirectorioInversionistas}
            rolUsuario={usuario?.rol}
            />

          
            <GraficoEstadistico/>

          </>
          
        )}
  {(usuario?.rol === 'owner') && (
<RegistrosRecientes
rolUsuario={usuario?.rol}
onVerFichaPrestamo={handleAbrirFichaPrestamo}
onAbrirCliente={(cliente) => {
setTipoDirectorio('clientes')
setPerfilSeleccionadoId(cliente?.id || null)
setModalActivo('directorio')
}}

onAbrirInversionista={(inversionista) => {
setTipoDirectorio('inversionistas')
setPerfilSeleccionadoId(inversionista?.id || null)
setModalActivo('directorio')
}}
/>

  )}
    </div>
  )
}