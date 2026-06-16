import { useState } from 'react'
import { Wind, RefreshCw, MapPin, BarChart3, ChevronRight } from 'lucide-react'
import MapView from '../components/map/MapView'
import ForecastChart from '../components/charts/ForecastChart'
import { useMapData, useCityForecast } from '../hooks/usePredictions'
import { AQI_BADGE, AQI_COLORS } from '../utils/aqi'

function Badge({ cat }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${AQI_BADGE[cat] ?? 'text-gray-400 border-gray-600'}`}>
      {cat}
    </span>
  )
}

export default function Dashboard() {
  const [city, setCity] = useState(null)
  const { data, loading, lastUpdate, refresh, error } = useMapData()
  const { data: forecast, loading: fcLoading } = useCityForecast(city)

  const sorted = [...data].sort((a, b) => b.pm25_pred - a.pm25_pred)
  const stats  = data.length ? {
    cities:  data.length,
    max:     Math.max(...data.map(d => d.pm25_pred)),
    avg:     data.reduce((s, d) => s + d.pm25_pred, 0) / data.length,
    polluted: data.filter(d => d.pm25_pred >= 35).length,
  } : null

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card/60 backdrop-blur px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wind size={20} className="text-blue-400" />
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">PM2.5 Maroc</h1>
            <p className="text-xs text-gray-500">Blend Enrichi V2 · H+1 → H+24</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && <span className="text-xs text-gray-500 hidden sm:block">Maj {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button onClick={refresh} className="p-1.5 rounded-lg border border-border hover:bg-white/5 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-400' : 'text-gray-500'} />
          </button>
        </div>
      </header>

      {/* Stats bar */}
      {stats && (
        <div className="shrink-0 border-b border-border bg-card/30 px-5 py-2 flex gap-5 text-xs overflow-x-auto">
          {[
            ['Villes',          stats.cities],
            ['Max PM2.5',       `${stats.max.toFixed(1)} µg/m³`],
            ['Moyenne',         `${stats.avg.toFixed(1)} µg/m³`],
            ['≥ Mauvais',       stats.polluted, stats.polluted > 0],
          ].map(([k, v, red]) => (
            <div key={k} className="flex flex-col shrink-0">
              <span className="text-gray-600">{k}</span>
              <span className={`font-semibold ${red ? 'text-red-400' : 'text-white'}`}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar gauche — liste villes */}
        <aside className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden bg-card/10">
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={12} />
            <span>53 villes (H+1)</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="text-center text-gray-600 text-sm py-8">Chargement...</div>}
            {error   && <div className="text-center text-red-400 text-xs py-6 px-3">{error}</div>}
            {sorted.map(d => (
              <button
                key={d.city}
                onClick={() => setCity(d.city)}
                className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors border-b border-border/40 text-left
                  ${city === d.city ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="flex-1 text-sm text-white truncate">{d.city}</span>
                <span className="text-xs font-semibold shrink-0" style={{ color: d.color }}>
                  {Number(d.pm25_pred).toFixed(1)}
                </span>
                <ChevronRight size={12} className="text-gray-600 shrink-0" />
              </button>
            ))}
          </div>
        </aside>

        {/* Carte principale */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-3">
            <MapView data={data} onCityClick={setCity} />
          </div>
          {/* Légende */}
          <div className="shrink-0 border-t border-border px-5 py-2 flex items-center gap-4 text-xs bg-card/20 overflow-x-auto">
            <span className="text-gray-600 shrink-0">Qualité :</span>
            {[['Bon','#2ECC71','< 15'], ['Modéré','#F39C12','15–35'], ['Mauvais','#E74C3C','35–75'], ['Très mauvais','#8E44AD','> 75']].map(([l,c,r]) => (
              <div key={l} className="flex items-center gap-1 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                <span className="text-gray-400">{l}</span>
                <span className="text-gray-600">({r})</span>
              </div>
            ))}
          </div>
        </main>

        {/* Panneau ville */}
        {city && (
          <aside className="w-72 shrink-0 border-l border-border flex flex-col overflow-hidden bg-card/10">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-blue-400" />
                <span className="font-semibold text-sm text-white">{city}</span>
              </div>
              {forecast?.current_category && <Badge cat={forecast.current_category} />}
            </div>

            {forecast?.current_pm25 != null && (
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs text-gray-500 mb-0.5">PM2.5 actuel</div>
                <div className="text-3xl font-bold" style={{ color: forecast.current_color }}>
                  {Number(forecast.current_pm25).toFixed(1)}
                  <span className="text-sm font-normal text-gray-400 ml-1">µg/m³</span>
                </div>
              </div>
            )}

            <div className="px-3 py-3 border-b border-border">
              <div className="text-xs text-gray-500 mb-2">Prévision 24h</div>
              {fcLoading
                ? <div className="text-gray-600 text-xs text-center py-8">Chargement...</div>
                : <ForecastChart forecasts={forecast?.forecasts ?? []} />
              }
            </div>

            <div className="flex-1 overflow-y-auto">
              {(forecast?.forecasts ?? []).map(f => (
                <div key={f.horizon_h} className="flex items-center gap-3 px-4 py-2 border-b border-border/30 hover:bg-white/3 text-sm">
                  <span className="text-gray-600 w-8 shrink-0 text-xs">+{f.horizon_h}h</span>
                  <span className="font-bold w-12 shrink-0" style={{ color: f.color }}>
                    {Number(f.pm25_pred).toFixed(1)}
                  </span>
                  <Badge cat={f.category} />
                  <span className="text-gray-700 text-xs ml-auto">{Math.round(f.confidence * 100)}%</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCity(null)}
              className="shrink-0 m-3 py-1.5 text-xs text-gray-500 border border-border rounded-lg hover:bg-white/5 transition-colors"
            >
              Fermer
            </button>
          </aside>
        )}
      </div>
    </div>
  )
}
