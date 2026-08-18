import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient' // Ajustá la ruta según tu estructura de carpetas

export default function FiltroProvincia({ 
  provinciaSeleccionada, 
  setProvinciaSeleccionada, 
  provincias: provinciasProp 
}) {
  const [listaProvincias, setListaProvincias] = useState([])

  useEffect(() => {
    // Si ya le pasamos provincias por props, usamos esas
    if (provinciasProp && provinciasProp.length > 0) {
      setListaProvincias(provinciasProp)
      return
    }

    // Si no vienen por props, las buscamos en Supabase
    async function fetchProvincias() {
      const { data, error } = await supabase
        .from('provincias')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) {
        console.error('Error al cargar provincias:', error)
      } else if (data) {
        setListaProvincias(data)
      }
    }

    fetchProvincias()
  }, [provinciasProp])

  return (
    <div className="relative inline-block">
      <select
        value={provinciaSeleccionada}
        onChange={(e) => setProvinciaSeleccionada(e.target.value)}
        className="appearance-none bg-cream border border-[#0d6b63] rounded-2xl px-4 py-2 pr-9 text-sm font-medium text-[#1d2939] shadow-sm hover:border-[#0b5a52] focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer transition-all"
      >
        <option value="todas">
          Todas las Provincias
        </option>
        {listaProvincias.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>

      {/* Flechita SVG personalizada */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#1d2939]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}