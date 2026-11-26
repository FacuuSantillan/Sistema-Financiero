import { Component } from 'react'

/**
 * Si un componente falla al dibujarse, en lugar de dejar la pantalla en blanco
 * muestra un aviso con la opción de recargar. Los datos ya guardados no se pierden.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error en la interfaz:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-white border border-line shadow-xl p-6 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-serif font-bold text-slate-900">Algo salió mal en la pantalla</h1>
          <p className="text-sm text-slate-600">
            Ocurrió un error inesperado. Los datos ya guardados no se perdieron.
            Recargá la página para seguir trabajando.
          </p>
          <pre className="text-[11px] text-left text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm hover:bg-[#0b5a52] cursor-pointer"
          >
            Recargar la aplicación
          </button>
        </div>
      </div>
    )
  }
}
