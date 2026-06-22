import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, MapPin, Wind, Droplets, Thermometer, Eye, ChevronRight, Clock, Menu, X, ChevronDown, ChevronUp } from 'lucide-react'
import MapView from '../components/MapView'
import ForecastTimeline from '../components/ForecastTimeline'
import { useMapData, useCityForecast, useClock } from '../hooks/usePredictions'
import { getCategory, getAQI } from '../utils/aqi'
import { getWeatherIcon, getWindDir } from '../utils/weather'
import { getRanking } from '../utils/api'

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

// ── Forecast hourly strip ─────────────────────────────────────────────
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

// ── useIsMobile hook ────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [city, setCity]           = useState(null)
  const [weather, setWeather]     = useState(null)
  const [wxLoading, setWxLoading] = useState(false)
  const [rankHorizon, setRankHorizon] = useState(1)
  const [rankData, setRankData]   = useState([])
  const [rankLoading, setRankLoading] = useState(false)

  // Mobile UI state
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState('map') // 'map' | 'list' | 'ranking'
  const [cityPanelOpen, setCityPanelOpen] = useState(false)

  const { data, loading, lastUpdate, refresh, error } = useMapData()
  const { data: forecast, loading: fcLoading }        = useCityForecast(city)
  const now = useClock()

  // Tri par PM2.5 décroissant (H+1 always for left column)
  const sorted = [...data].sort((a, b) => b.pm25_pred - a.pm25_pred)

  // Stats globales
  const stats = data.length ? {
    cities:   data.length,
    max:      Math.max(...data.map(d => d.pm25_pred)),
    avg:      data.reduce((s, d) => s + d.pm25_pred, 0) / data.length,
    good:     data.filter(d => d.pm25_pred < 15).length,
    bad:      data.filter(d => d.pm25_pred >= 35).length,
  } : null

  // Fetch ranking for selected horizon
  useEffect(() => {
    setRankLoading(true)
    getRanking(rankHorizon)
      .then(r => setRankData(r.ranking || []))
      .catch(() => setRankData([]))
      .finally(() => setRankLoading(false))
  }, [rankHorizon])

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

  const handleCityClick = useCallback((c) => {
    const newCity = c === city ? null : c
    setCity(newCity)
    if (isMobile && newCity) {
      setCityPanelOpen(true)
      setMobileTab('map')
    }
  }, [city, isMobile])

  // Météo actuelle de la ville
  const currentWx = weather?.list?.[0]
  const cityData  = city ? data.find(d => d.city === city) : null

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // ── City Detail Panel (shared between mobile/desktop) ──────────────────
  const CityPanel = () => (
    <div style={{
      flex: 1, overflowY: 'auto', borderTop: isMobile ? 'none' : '1px solid #d1fae5',
      padding: '10px 14px', background: '#fff', minHeight: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{city}</div>
          {forecast?.current_pm25 != null && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: getAQI(forecast.current_category)?.color }}>
                {Number(forecast.current_pm25).toFixed(1)}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>µg/m³ actuel</span>
              <AqiBadge cat={forecast.current_category} size="lg" />
            </div>
          )}
        </div>
        {currentWx && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <WxCard icon={getWeatherIcon(currentWx.weather[0]?.icon)} label="Temps" value={Math.round(currentWx.main.temp)} unit="°C" />
            <WxCard icon="💧" label="Humidité" value={currentWx.main.humidity} unit="%" />
            <WxCard icon="💨" label="Vent" value={Number(currentWx.wind.speed).toFixed(1)} unit="m/s" />
            <WxCard icon="👁" label="Visibilité" value={currentWx.visibility ? Math.round(currentWx.visibility/1000) : '–'} unit="km" />
          </div>
        )}
      </div>

      {!fcLoading && forecast?.forecasts?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>PRÉVISIONS HEURE PAR HEURE</div>
          <HourlyStrip forecasts={forecast.forecasts} weather={weather} />
        </div>
      )}

      {!fcLoading && forecast?.forecasts?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>ÉVOLUTION PM2.5 + MÉTÉO</div>
          <ForecastTimeline forecasts={forecast.forecasts} weather={weather?.list ?? []} />
        </div>
      )}

      {fcLoading && (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement des prévisions...</div>
      )}

      <button
        onClick={() => { setCity(null); setCityPanelOpen(false) }}
        style={{
          marginTop: 8, padding: '6px 14px', fontSize: 11,
          color: '#64748b', background: 'transparent',
          border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
        }}
      >
        Fermer
      </button>
    </div>
  )

  // ── Ranking panel (right column) ──────────────────────────────────────
  const RankingPanel = ({ compact = false }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sélecteur horizon */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #f0fdf4',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
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

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rankLoading && <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement...</div>}
        {!rankLoading && rankData.map((d, i) => {
          const a = getAQI(d.category)
          return (
            <button
              key={d.city}
              onClick={() => handleCityClick(d.city)}
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
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
            </button>
          )
        })}
        {!rankLoading && !rankData.length && (
          <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Aucune donnée</div>
        )}
      </div>
    </div>
  )

  // ── Left city list ──────────────────────────────────────────────────────
  const CityList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 12px 8px', borderBottom: '1px solid #e8fdf0',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        <MapPin size={12} color="#48d99a" />
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Classement H+1</span>
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
              onClick={() => handleCityClick(d.city)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', border: 'none', borderBottom: '1px solid #f0fdf4',
                background: isActive ? '#f0fdf4' : 'transparent',
                borderLeft: isActive ? '3px solid #48d99a' : '3px solid transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 10, color: '#94a3b8', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
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
  )

  // ── MOBILE LAYOUT ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fffe', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

        {/* Mobile Header */}
        <header style={{
          flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5',
          padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, background: '#b8ffd9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌿</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>Air Qualité Maroc</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>PM2.5 · 53 villes</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'capitalize' }}>{dateStr}</div>
          </div>
        </header>

        {/* Mobile Stats Bar */}
        {stats && (
          <div style={{
            flexShrink: 0, background: '#fff', borderBottom: '1px solid #f0fdf4',
            padding: '6px 14px', display: 'flex', gap: 10, overflowX: 'auto',
          }}>
            <div style={{ flexShrink: 0, fontSize: 11, color: '#64748b' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{stats.cities}</span> villes
            </div>
            <div style={{ flexShrink: 0, fontSize: 11 }}>
              Moy. <span style={{ fontWeight: 700, color: stats.avg > 35 ? '#ef4444' : stats.avg > 15 ? '#f59e0b' : '#22c55e' }}>{stats.avg.toFixed(1)} µg/m³</span>
            </div>
            <div style={{ flexShrink: 0, fontSize: 11, color: '#22c55e', fontWeight: 600 }}>✓ {stats.good} bonnes</div>
            <div style={{ flexShrink: 0, fontSize: 11, color: stats.bad > 0 ? '#ef4444' : '#0f172a', fontWeight: 600 }}>⚠ {stats.bad} mauvaises</div>
            <button onClick={refresh} style={{ flexShrink: 0, background: '#b8ffd9', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#065f46', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Actualiser
            </button>
          </div>
        )}

        {/* Mobile Tab Bar */}
        <div style={{
          flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5',
          display: 'flex',
        }}>
          {[['map', '🗺️', 'Carte'], ['list', '📋', 'Villes H+1'], ['ranking', '📊', 'Horizon']].map(([tab, icon, label]) => (
            <button key={tab} onClick={() => { setMobileTab(tab); if (tab !== 'map') setCityPanelOpen(false) }}
              style={{
                flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 11,
                fontWeight: mobileTab === tab ? 700 : 400,
                color: mobileTab === tab ? '#065f46' : '#64748b',
                background: mobileTab === tab ? '#f0fdf4' : '#fff',
                borderBottom: mobileTab === tab ? '2px solid #48d99a' : '2px solid transparent',
              }}
            >
              <div style={{ fontSize: 16 }}>{icon}</div>
              {label}
            </button>
          ))}
        </div>

        {/* Mobile Content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* Map Tab */}
          {mobileTab === 'map' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Map */}
              <div style={{ flex: cityPanelOpen ? '0 0 45%' : 1, minHeight: 0, position: 'relative' }}>
                <div style={{ height: '100%', margin: '6px', borderRadius: 10, overflow: 'hidden', border: '1px solid #d1fae5' }}>
                  <MapView data={data} onCityClick={handleCityClick} selectedCity={city} />
                </div>
                {/* Legend overlay on map */}
                <div style={{
                  position: 'absolute', bottom: 14, left: 14,
                  background: 'rgba(255,255,255,0.92)', borderRadius: 8,
                  padding: '6px 10px', border: '1px solid #d1fae5',
                  backdropFilter: 'blur(4px)',
                }}>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>Qualité de l'air :</div>
                  {[['Bon','#22c55e','< 15 µg/m³'], ['Modéré','#f59e0b','15–35 µg/m³'], ['Mauvais','#ef4444','35–75 µg/m³'], ['Très mauvais','#a855f7','> 75 µg/m³']].map(([l,c,r]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: '#0f172a', fontWeight: 500 }}>{l}</span>
                      <span style={{ fontSize: 9, color: '#94a3b8' }}>({r})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* City Panel Drawer */}
              {city && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid #d1fae5' }}>
                  {/* Drawer handle */}
                  <div
                    onClick={() => setCityPanelOpen(v => !v)}
                    style={{ padding: '8px 14px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{city}</span>
                    {cityPanelOpen ? <ChevronDown size={16} color="#48d99a" /> : <ChevronUp size={16} color="#48d99a" />}
                  </div>
                  {cityPanelOpen && <CityPanel />}
                </div>
              )}
            </div>
          )}

          {/* List Tab */}
          {mobileTab === 'list' && (
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <CityList />
            </div>
          )}

          {/* Ranking Tab */}
          {mobileTab === 'ranking' && (
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <RankingPanel />
            </div>
          )}
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

  // ── DESKTOP LAYOUT ──────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#f8fffe', fontFamily: "'Inter', system-ui, sans-serif",
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5',
        padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#b8ffd9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌿</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Air Qualité Maroc</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>PM2.5 · 53 villes · Prévisions 24h</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{timeStr}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{dateStr}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {stats && (
            <>
              <StatPill label="Villes actives" value={stats.cities} />
              <StatPill label="Moy. PM2.5" value={`${stats.avg.toFixed(1)} µg/m³`} color={stats.avg > 35 ? '#ef4444' : stats.avg > 15 ? '#f59e0b' : '#22c55e'} />
              <StatPill label="Qualité bonne" value={`${stats.good} villes`} color="#22c55e" />
              <StatPill label="Qualité mauvaise" value={`${stats.bad} villes`} color={stats.bad > 0 ? '#ef4444' : '#0f172a'} />
            </>
          )}
          <button
            onClick={refresh}
            style={{ background: '#b8ffd9', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#065f46', fontWeight: 600 }}
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

        {/* Colonne gauche : liste villes H+1 */}
        <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #e8fdf0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CityList />
        </div>

        {/* Centre : carte + panneau ville */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Carte */}
          <div style={{ flex: city ? '0 0 52%' : '1', padding: '10px 10px 6px', minHeight: 0 }}>
            <div style={{ height: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #d1fae5' }}>
              <MapView data={data} onCityClick={c => handleCityClick(c)} selectedCity={city} />
            </div>
          </div>

          {/* Légende qualité */}
          <div style={{
            flexShrink: 0, padding: '4px 14px',
            display: 'flex', gap: 14, alignItems: 'center',
            borderTop: city ? '1px solid #f0fdf4' : 'none',
          }}>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Qualité de l'air :</span>
            {[['Bon','#22c55e','< 15 µg/m³'], ['Modéré','#f59e0b','15–35 µg/m³'], ['Mauvais','#ef4444','35–75 µg/m³'], ['Très mauvais','#a855f7','> 75 µg/m³']].map(([l,c,r]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>{l}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>({r})</span>
              </div>
            ))}
          </div>

          {/* Panneau ville sélectionnée */}
          {city && <CityPanel />}
        </div>

        {/* Colonne droite : classement horizon */}
        <div style={{ width: 260, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e8fdf0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <RankingPanel />
          {/* Footer info only */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f0fdf4', background: '#f8fffe', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>
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
