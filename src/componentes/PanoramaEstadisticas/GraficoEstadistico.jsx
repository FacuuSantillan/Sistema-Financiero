import React, { useState, useEffect } from 'react'
import { RefreshCw, Users, Briefcase, CreditCard, TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'
import { supabase } from '../../lib/supabaseClient'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function GraficoEstadistico() {
  const [modo, setModo] = useState('mensual') // 'mensual' (diario) | 'anual' (meses)
  const fechaActual = new Date()
  const [anioSeleccionado, setAnioSeleccionado] = useState(fechaActual.getFullYear())
  const [mesSeleccionado, setMesSeleccionado] = useState(fechaActual.getMonth() + 1)

  const [datosGrafico, setDatosGrafico] = useState([])
  const [totalesPeriodo, setTotalesPeriodo] = useState({
    clientes: 0,
    inversionistas: 0,
    prestamos: 0,
    interes: 0
  })
  const [loading, setLoading] = useState(true)

  const cargarEstadisticas = async () => {
    setLoading(true)
    try {
      // 1. Cargar Clientes (ahora con created_at)
      const { data: clientes, error: errC } = await supabase
        .from('clientes')
        .select('created_at')
      
      if (errC) console.error('Error clientes:', errC)

      // 2. Cargar Inversionistas (ahora con created_at)
      const { data: inversionistas, error: errI } = await supabase
        .from('usuarios')
        .select('created_at')
        .eq('rol', 'inversionista')
      
      if (errI) console.error('Error inversionistas:', errI)

      // 3. Cargar Préstamos (utiliza fecha_inicio y created_at)
      const { data: prestamos, error: errP } = await supabase
        .from('prestamos')
        .select('created_at, fecha_inicio, monto_capital, monto_total_pagar')
      
      if (errP) console.error('Error préstamos:', errP)

      const listaClientes = clientes || []
      const listaInversionistas = inversionistas || []
      const listaPrestamos = prestamos || []

      if (modo === 'anual') {
        const desgloseAnual = MESES.map((nombreMes, index) => {
          const numMes = index + 1

          const cantClientes = listaClientes.filter(c => coincideMes(c.created_at, anioSeleccionado, numMes)).length
          const cantInversionistas = listaInversionistas.filter(i => coincideMes(i.created_at, anioSeleccionado, numMes)).length
          const prestamosMes = listaPrestamos.filter(p => coincideMes(p.fecha_inicio || p.created_at, anioSeleccionado, numMes))
          
          const interesMes = calcularInteres(prestamosMes)

          return {
            periodo: nombreMes.substring(0, 3),
            clientes: cantClientes,
            inversionistas: cantInversionistas,
            prestamos: prestamosMes.length,
            interes: interesMes
          }
        })

        setDatosGrafico(desgloseAnual)
        actualizarTotales(desgloseAnual)

      } else {
        // Modo Mensual con desglose diario (1 al 31)
        const diasEnMes = new Date(anioSeleccionado, mesSeleccionado, 0).getDate()
        
        const desgloseDiario = Array.from({ length: diasEnMes }, (_, i) => {
          const dia = i + 1

          const cantClientes = listaClientes.filter(c => coincideDia(c.created_at, anioSeleccionado, mesSeleccionado, dia)).length
          const cantInversionistas = listaInversionistas.filter(inv => coincideDia(inv.created_at, anioSeleccionado, mesSeleccionado, dia)).length
          const prestamosDia = listaPrestamos.filter(p => coincideDia(p.fecha_inicio || p.created_at, anioSeleccionado, mesSeleccionado, dia))
          
          const interesDia = calcularInteres(prestamosDia)

          return {
            periodo: dia.toString(),
            clientes: cantClientes,
            inversionistas: cantInversionistas,
            prestamos: prestamosDia.length,
            interes: interesDia
          }
        })

        setDatosGrafico(desgloseDiario)
        actualizarTotales(desgloseDiario)
      }

    } catch (err) {
      console.error('Error al generar estadísticas:', err)
    } finally {
      setLoading(false)
    }
  }

  // Comparadores directos de texto para evitar errores de huso horario
  const coincideMes = (fechaStr, anio, mes) => {
    if (!fechaStr) return false
    const year = parseInt(fechaStr.substring(0, 4), 10)
    const month = parseInt(fechaStr.substring(5, 7), 10)
    return year === Number(anio) && month === Number(mes)
  }

  const coincideDia = (fechaStr, anio, mes, dia) => {
    if (!fechaStr) return false
    const year = parseInt(fechaStr.substring(0, 4), 10)
    const month = parseInt(fechaStr.substring(5, 7), 10)
    const day = parseInt(fechaStr.substring(8, 10), 10)
    return year === Number(anio) && month === Number(mes) && day === Number(dia)
  }

  const calcularInteres = (prestamosArr) => {
    return prestamosArr.reduce((acc, p) => {
      const capital = Number(p.monto_capital || 0)
      const totalPagar = Number(p.monto_total_pagar || 0)
      return acc + Math.max(0, totalPagar - capital)
    }, 0)
  }

  const actualizarTotales = (datos) => {
    setTotalesPeriodo({
      clientes: datos.reduce((acc, d) => acc + d.clientes, 0),
      inversionistas: datos.reduce((acc, d) => acc + d.inversionistas, 0),
      prestamos: datos.reduce((acc, d) => acc + d.prestamos, 0),
      interes: datos.reduce((acc, d) => acc + d.interes, 0)
    })
  }

  useEffect(() => {
    cargarEstadisticas()
  }, [modo, mesSeleccionado, anioSeleccionado])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const titulo = modo === 'mensual' ? `Día ${label} de ${MESES[mesSeleccionado - 1]}` : `Mes de ${label}`
      
      return (
        <div className="bg-white p-4 rounded-2xl border border-line shadow-2xl text-xs min-w-[200px]">
          <p className="font-bold text-slate-900 border-b border-line pb-2 mb-2 uppercase tracking-wide">
            {titulo}
          </p>
          <div className="space-y-2">
            {payload.map((entry, index) => {
              if (entry.value === 0) return null
              return (
                <div key={index} className="flex items-center justify-between gap-6">
                  <span className="font-semibold flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ backgroundColor: entry.color }} />
                    {entry.name}:
                  </span>
                  <span className="font-bold text-slate-900">
                    {entry.dataKey === 'interes'
                      ? `$${Number(entry.value).toLocaleString('es-AR')}`
                      : entry.value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <section className="w-[95%] mx-auto space-y-5 my-8 select-none">
      
      {/* Cabecera */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-line shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">
            Estadisticas
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-line">
            <button
              onClick={() => setModo('mensual')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                modo === 'mensual' ? 'bg-[#0d6b63] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Diario
            </button>
            <button
              onClick={() => setModo('anual')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                modo === 'anual' ? 'bg-[#0d6b63] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Mensual
            </button>
          </div>

          {modo === 'mensual' && (
            <select
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(Number(e.target.value))}
              className="rounded-2xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
            >
              {MESES.map((m, idx) => (
                <option key={idx} value={idx + 1}>{m}</option>
              ))}
            </select>
          )}

          <select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
            className="rounded-2xl border border-line bg-white px-3.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 cursor-pointer shadow-xs"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>

          <button
            onClick={cargarEstadisticas}
            disabled={loading}
            title="Recargar métricas"
            className="p-2 rounded-2xl bg-white border border-line shadow-xs text-slate-500 hover:text-[#0d6b63] hover:border-[#0d6b63]/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tarjetas Superiores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-line shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nuevos Clientes</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Users className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{totalesPeriodo.clientes}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-line shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Inversores creados</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Briefcase className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-bold text-slate-800">{totalesPeriodo.inversionistas}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-line shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Préstamos Emitidos</span>
            <div className="p-1.5 rounded-lg bg-[#0d6b63]/10 text-[#0d6b63]"><CreditCard className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-bold text-[#0d6b63]">{totalesPeriodo.prestamos}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-line shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rendimiento (Interés)</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            +${totalesPeriodo.interes.toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white border border-line shadow-xs h-[450px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm font-medium text-slate-400">
            Procesando métricas operativas...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={datosGrafico}
              margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
              
              <XAxis 
                dataKey="periodo" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} 
                dy={10}
              />
              
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                stroke="#94a3b8" 
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }} 
                allowDecimals={false}
              />

              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#10b981" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 11, fontWeight: 600 }}
                tickFormatter={(val) => `$${val > 999 ? (val/1000).toFixed(0) + 'k' : val}`}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold', color: '#475569' }} />

              <Bar yAxisId="left" dataKey="clientes" name="Clientes Nuevos" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar yAxisId="left" dataKey="inversionistas" name="Inversores" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar yAxisId="left" dataKey="prestamos" name="Préstamos" fill="#0d6b63" radius={[4, 4, 0, 0]} maxBarSize={30} />
              
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="interes" 
                name="Interés Generado" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

    </section>
  )
}