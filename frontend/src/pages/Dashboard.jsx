import { useState, useEffect, useRef } from 'react'
import { RefreshCw, MapPin, Wind, Droplets, Thermometer, Eye, ChevronRight, Clock } from 'lucide-react'
import MapView from '../components/MapView'
import ForecastTimeline from '../components/ForecastTimeline'
import { useMapData, useCityForecast, useClock } from '../hooks/usePredictions'
import { getCategory, getAQI } from '../utils/aqi'
import { getWeatherIcon, getWindDir } from '../utils/weather'

// ── Helpers ────────────────────────────────────────────────────────────────
function AqiBadge({ cat, size = 'sm' }) {
  const a = getAQI(cat)
  const pad = size === 'lg' ? '6px 14px' : '3px 10px'
  const fs = size === 'lg' ? 13 : 11
  return (
    <span style={{
      background: a.bg, color: a.text, border: `1px solid ${a.border}`,
      borderRadius: 20, padding: pad, fontSize: fs, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>{cat}</span>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', minWidth: 90,
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || '#0f172a' }}>{value}</div>
    </div>
  )
}

function WxCard({ icon, label, value, unit }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: '#f8fffe', border: '1px solid #d1fae5',
      borderRadius: 10, padding: '8px 12px', flex: 1, minWidth: 60,
    }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{value}<span style={{ fontSize: 11, color: '#64748b', marginLeft: 2 }}>{unit}</span></div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{label}</div>
    </div>
  )
}

// ── Forecast hourly strip (PM2.5 + météo heure par heure) ─────────────────
function HourlyStrip({ forecasts, weather }) {
  const now = new Date()

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
        {forecasts.map((f, i) => {
          const dt = new Date(f.datetime)
          const hh = String(dt.getHours()).padStart(2, '0') + ':00'
          const a = getAQI(f.category)
          const wx = weather?.list?.find(w => {
            const wDt = new Date(w.dt * 1000)
            return Math.abs(wDt - dt) < 90 * 60 * 1000
          })

          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: '#fff', border: `1px solid ${a.border}`,
              borderRadius: 10, padding: '8px 10px', minWidth: 62,
            }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{hh}</div>
              {wx && <div style={{ fontSize: 16, margin: '3px 0' }}>{getWeatherIcon(wx.weather[0]?.icon)}</div>}
              <div style={{ fontSize: 14, fontWeight: 800, color: a.color, margin: '2px 0' }}>
                {Number(f.pm25_pred).toFixed(1)}
              </div>
              <div style={{ fontSize: 9, color: '#64748b' }}>µg/m³</div>
              {wx && (
                <div style={{ fontSize: 10, color: '#f97316', fontWeight: 600, marginTop: 2 }}>
                  {Math.round(wx.main.temp)}°
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [city, setCity]           = useState(null)
  const [weather, setWeather]     = useState(null)
  const [wxLoading, setWxLoading] = useState(false)
  const [rankHorizon, setRankHorizon] = useState(1)

  const { data, loading, lastUpdate, refresh, error } = useMapData()
  const { data: forecast, loading: fcLoading }        = useCityForecast(city)
  const now = useClock()

  // Tri par PM2.5 décroissant
  const sorted = [...data].sort((a, b) => b.pm25_pred - a.pm25_pred)

  // Stats globales
  const stats = data.length ? {
    cities:   data.length,
    max:      Math.max(...data.map(d => d.pm25_pred)),
    avg:      data.reduce((s, d) => s + d.pm25_pred, 0) / data.length,
    good:     data.filter(d => d.pm25_pred < 15).length,
    bad:      data.filter(d => d.pm25_pred >= 35).length,
  } : null

  // Météo OWM quand une ville est sélectionnée
  useEffect(() => {
    if (!city || !data.length) return
    const cityData = data.find(d => d.city === city)
    if (!cityData) return
    setWxLoading(true)
    fetch(`/api/weather/forecast?lat=${cityData.lat}&lon=${cityData.lon}`)
      .then(r => r.json())
      .then(d => setWeather(d))
      .catch(() => setWeather(null))
      .finally(() => setWxLoading(false))
  }, [city])

  // Météo actuelle de la ville
  const currentWx = weather?.list?.[0]
  const cityData  = city ? data.find(d => d.city === city) : null

  // Horizon ranking
  const rankData = sorted.filter(d => d)

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#f8fffe', fontFamily: "'Inter', system-ui, sans-serif",
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        background: '#fff',
        borderBottom: '1px solid #d1fae5',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: '#b8ffd9', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🌿</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Air Qualité Maroc</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>PM2.5 · 53 villes · Prévisions 24h</div>
          </div>
        </div>

        {/* Horloge */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{dateStr}</div>
        </div>

        {/* Stats + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {stats && (
            <>
              <StatPill label="Villes actives" value={stats.cities} />
              <StatPill
                label="Moy. PM2.5"
                value={`${stats.avg.toFixed(1)} µg/m³`}
                color={stats.avg > 35 ? '#ef4444' : stats.avg > 15 ? '#f59e0b' : '#22c55e'}
              />
              <StatPill label="Qualité bonne" value={`${stats.good} villes`} color="#22c55e" />
              <StatPill label="Qualité mauvaise" value={`${stats.bad} villes`} color={stats.bad > 0 ? '#ef4444' : '#0f172a'} />
            </>
          )}
          <button
            onClick={refresh}
            style={{
              background: '#b8ffd9', border: 'none', borderRadius: 8, padding: '8px 10px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#065f46', fontWeight: 600,
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </button>
          {lastUpdate && (
            <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              Maj {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </header>

      {/* ── Corps principal ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

        {/* Colonne gauche : liste villes */}
        <div style={{
          width: 220, flexShrink: 0, background: '#fff',
          borderRight: '1px solid #e8fdf0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 12px 8px', borderBottom: '1px solid #e8fdf0',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <MapPin size={12} color="#48d99a" />
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              Classement H+1
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement...</div>}
            {error   && <div style={{ padding: 12, color: '#ef4444', fontSize: 11 }}>{error}</div>}
            {sorted.map((d, i) => {
              const a = getAQI(d.category)
              const isActive = d.city === city
              return (
                <button
                  key={d.city}
                  onClick={() => setCity(d.city === city ? null : d.city)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', border: 'none', borderBottom: '1px solid #f0fdf4',
                    background: isActive ? '#f0fdf4' : 'transparent',
                    borderLeft: isActive ? '3px solid #48d99a' : '3px solid transparent',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#94a3b8', width: 18, textAlign: 'right', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: a.color, flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, fontSize: 12, color: '#0f172a', fontWeight: isActive ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.city}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: a.color, flexShrink: 0 }}>
                    {Number(d.pm25_pred).toFixed(1)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Centre : carte + panneau ville */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Carte */}
          <div style={{ flex: city ? '0 0 52%' : '1', padding: '10px 10px 6px', minHeight: 0 }}>
            <div style={{ height: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #d1fae5' }}>
              <MapView data={data} onCityClick={c => setCity(c === city ? null : c)} selectedCity={city} />
            </div>
          </div>

          {/* Légende qualité */}
          <div style={{
            flexShrink: 0, padding: '4px 14px',
            display: 'flex', gap: 14, alignItems: 'center',
            borderTop: city ? '1px solid #f0fdf4' : 'none',
          }}>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Qualité de l'air :</span>
            {[['Bon','#22c55e','< 15'], ['Modéré','#f59e0b','15–35'], ['Mauvais','#ef4444','35–75'], ['Très mauvais','#a855f7','> 75']].map(([l,c,r]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>{l}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>({r} µg/m³)</span>
              </div>
            ))}
          </div>

          {/* Panneau ville sélectionnée */}
          {city && (
            <div style={{
              flex: 1, overflowY: 'auto', borderTop: '1px solid #d1fae5',
              padding: '10px 14px', background: '#fff', minHeight: 0,
            }}>
              {/* En-tête ville */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{city}</div>
                  {forecast?.current_pm25 != null && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, color: getAQI(forecast.current_category)?.color }}>
                        {Number(forecast.current_pm25).toFixed(1)}
                      </span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>µg/m³ actuel</span>
                      <AqiBadge cat={forecast.current_category} size="lg" />
                    </div>
                  )}
                </div>
                {/* Météo actuelle */}
                {currentWx && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <WxCard icon={getWeatherIcon(currentWx.weather[0]?.icon)} label="Temps" value={Math.round(currentWx.main.temp)} unit="°C" />
                    <WxCard icon="💧" label="Humidité" value={currentWx.main.humidity} unit="%" />
                    <WxCard icon="💨" label="Vent" value={Number(currentWx.wind.speed).toFixed(1)} unit="m/s" />
                    <WxCard icon="👁" label="Visibilité" value={currentWx.visibility ? Math.round(currentWx.visibility/1000) : '–'} unit="km" />
                  </div>
                )}
              </div>

              {/* Prévisions horaires scroll horizontal */}
              {!fcLoading && forecast?.forecasts?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
                    PRÉVISIONS HEURE PAR HEURE
                  </div>
                  <HourlyStrip forecasts={forecast.forecasts} weather={weather} />
                </div>
              )}

              {/* Graphique PM2.5 + météo */}
              {!fcLoading && forecast?.forecasts?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
                    ÉVOLUTION PM2.5 + MÉTÉO
                  </div>
                  <ForecastTimeline forecasts={forecast.forecasts} weather={weather?.list ?? []} />
                </div>
              )}

              {fcLoading && (
                <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement des prévisions...</div>
              )}

              <button
                onClick={() => setCity(null)}
                style={{
                  marginTop: 8, padding: '6px 14px', fontSize: 11,
                  color: '#64748b', background: 'transparent',
                  border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
                }}
              >
                Fermer
              </button>
            </div>
          )}
        </div>

        {/* Colonne droite : classement H+N + top polluées */}
        <div style={{
          width: 260, flexShrink: 0, background: '#fff',
          borderLeft: '1px solid #e8fdf0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Sélecteur horizon */}
          <div style={{
            padding: '10px 12px', borderBottom: '1px solid #f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Prévision par horizon</span>
            <select
              value={rankHorizon}
              onChange={e => setRankHorizon(Number(e.target.value))}
              style={{
                fontSize: 11, background: '#f0fdf4', border: '1px solid #d1fae5',
                borderRadius: 6, padding: '3px 6px', color: '#065f46', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map(h => (
                <option key={h} value={h}>H+{h}</option>
              ))}
            </select>
          </div>

          {/* Tableau de bord horizon sélectionné */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sorted.map((d, i) => {
              // Pour le bon horizon, on utilise le forecast de la ville si disponible
              // sinon on affiche juste le H+1
              const a = getAQI(d.category)
              return (
                <button
                  key={d.city}
                  onClick={() => setCity(d.city === city ? null : d.city)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', border: 'none', borderBottom: '1px solid #f8fffe',
                    background: d.city === city ? '#f0fdf4' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#94a3b8', width: 18, textAlign: 'right' }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#0f172a', fontWeight: d.city === city ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.city}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: a.color }}>
                      {Number(d.pm25_pred).toFixed(1)}
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>µg/m³</div>
                  </div>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: a.color, flexShrink: 0,
                  }} />
                </button>
              )
            })}
          </div>

          {/* Légende qualité compact */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f0fdf4', background: '#f8fffe' }}>
            {[['Bon','#22c55e'], ['Modéré','#f59e0b'], ['Mauvais','#ef4444'], ['Très mauvais','#a855f7']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>{l}</span>
              </div>
            ))}
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>
              Données : OpenWeatherMap · Actua. automatique 5 min
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        button:hover { opacity: 0.88 }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f8fffe; }
        ::-webkit-scrollbar-thumb { background: #b8ffd9; border-radius: 2px; }
      `}</style>
    </div>
  )
}
