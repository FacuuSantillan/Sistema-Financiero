import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { normalizarPunitorioGeneral, PUNITORIO_GENERAL_POR_DEFECTO } from './finanzas'

/**
 * Configuración general de punitorio (tabla `configuracion`, fila id = 1).
 * Es compartida por todos los usuarios. Si la tabla todavía no existe
 * (no se corrió db/schema.sql), usa los valores por defecto y lo avisa.
 */
export function usePunitorioGeneral(activo = true) {
  const [config, setConfig] = useState(PUNITORIO_GENERAL_POR_DEFECTO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error: err } = await supabase
      .from('configuracion')
      .select('punitorio_tasa, punitorio_cada_dias')
      .eq('id', 1)
      .maybeSingle()

    if (err) {
      console.warn('No se pudo leer la configuración de punitorio:', err.message)
      setError('No se encontró la configuración general de punitorio. Ejecutá db/schema.sql en Supabase.')
    } else {
      setError('')
    }
    setConfig(normalizarPunitorioGeneral(data))
    setCargando(false)
  }, [])

  useEffect(() => {
    if (activo) cargar()
  }, [activo, cargar])

  const guardar = useCallback(async ({ tasa, cadaDias }) => {
    const fila = {
      id: 1,
      punitorio_tasa: Math.max(0, Number(tasa) || 0),
      punitorio_cada_dias: Math.max(1, Math.floor(Number(cadaDias) || 1)),
      updated_at: new Date().toISOString()
    }
    const { error: err } = await supabase.from('configuracion').upsert(fila)
    if (err) throw new Error(err.message)
    setConfig(normalizarPunitorioGeneral(fila))
    setError('')
  }, [])

  return { config, cargando, error, recargar: cargar, guardar }
}
