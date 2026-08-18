import React from 'react'
import { Search, ChevronRight } from 'lucide-react'

export default function ListaLateralClientes({
  lista = [],
  itemSeleccionado = null,
  busqueda = '',
  loading = false,
  placeholderBusqueda = 'Buscar...',
  mensajeVacio = 'No hay registros.',
  tituloHeader = null,
  mostrarBordeDerecho = true,
  onSeleccionarItem,
  onCambiarBusqueda
}) {
  return (
    <div className={`flex flex-col h-full overflow-hidden ${
      mostrarBordeDerecho ? 'border-r border-line/60 pr-0 md:pr-4' : 'border-l border-line/60 pl-0 md:pl-4'
    }`}>
      {/* Buscador */}
      <div className="relative mb-3 shrink-0">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          placeholder={placeholderBusqueda}
          value={busqueda}
          onChange={(e) => onCambiarBusqueda(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-line text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
        />
      </div>

      {tituloHeader && (
        <div className="mb-2 px-1 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {tituloHeader} ({lista.length})
          </span>
        </div>
      )}

      {/* Lista scrolleable */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-6">Cargando lista...</p>
        ) : lista.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">{mensajeVacio}</p>
        ) : (
          lista.map((item) => {
            const estaActivo = item.activo ?? true
            const esSeleccionado = itemSeleccionado?.id === item.id

            return (
              <div
                key={item.id}
                onClick={() => onSeleccionarItem(item)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  esSeleccionado
                    ? 'bg-[#0d6b63] text-white border-[#0d6b63] shadow-sm'
                    : 'bg-white border-line text-slate-800 hover:border-[#0d6b63]/40'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm leading-tight">
                      {item.nombre_completo || item.nombre || 'Sin nombre'}
                    </h4>
                    {!estaActivo && (
                      <span className="text-[9px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] ${esSeleccionado ? 'text-white/80' : 'text-slate-500'}`}>
                    Tel: {item.telefono || 'Sin teléfono'}
                  </span>
                </div>
                <ChevronRight className={`w-4 h-4 ${esSeleccionado ? 'opacity-70' : 'text-slate-400'}`} />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}