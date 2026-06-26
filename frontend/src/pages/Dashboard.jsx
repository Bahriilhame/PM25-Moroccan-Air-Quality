// import { useState, useEffect, useCallback } from 'react'
// import { RefreshCw, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
// import MapView from '../components/MapView'
// import ForecastTimeline from '../components/ForecastTimeline'
// import { useMapData, useCityForecast, useClock } from '../hooks/usePredictions'
// import { getAQI } from '../utils/aqi'
// import { getWeatherIcon } from '../utils/weather'
// import { getRanking } from '../utils/api'

// // ─────────────────────────────────────────────────────────────────────────────
// // PURE HELPER COMPONENTS  (defined outside Dashboard → never remounted)
// // ─────────────────────────────────────────────────────────────────────────────

// function AqiBadge({ cat, size = 'sm' }) {
//   const a = getAQI(cat)
//   return (
//     <span style={{
//       background: a.bg, color: a.text, border: `1px solid ${a.border}`,
//       borderRadius: 20, padding: size === 'lg' ? '6px 14px' : '3px 10px',
//       fontSize: size === 'lg' ? 13 : 11, fontWeight: 600, whiteSpace: 'nowrap',
//     }}>{cat}</span>
//   )
// }

// function StatPill({ label, value, color }) {
//   return (
//     <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', minWidth: 90 }}>
//       <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
//       <div style={{ fontSize: 16, fontWeight: 700, color: color || '#0f172a' }}>{value}</div>
//     </div>
//   )
// }

// function WxCard({ icon, label, value, unit }) {
//   return (
//     <div style={{
//       display: 'flex', flexDirection: 'column', alignItems: 'center',
//       background: '#f8fffe', border: '1px solid #d1fae5',
//       borderRadius: 10, padding: '8px 12px', flex: 1, minWidth: 60,
//     }}>
//       <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
//       <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
//         {value}<span style={{ fontSize: 11, color: '#64748b', marginLeft: 2 }}>{unit}</span>
//       </div>
//       <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{label}</div>
//     </div>
//   )
// }

// function HourlyStrip({ forecasts, weather }) {
//   return (
//     <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
//       <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
//         {(forecasts || []).map((f, i) => {
//           const dt = new Date(f.datetime)
//           const hh = String(dt.getHours()).padStart(2, '0') + ':00'
//           const a = getAQI(f.category)
//           const wx = weather?.list?.find(w => Math.abs(new Date(w.dt * 1000) - dt) < 90 * 60 * 1000)
//           return (
//             <div key={i} style={{
//               display: 'flex', flexDirection: 'column', alignItems: 'center',
//               background: '#fff', border: `1px solid ${a.border}`,
//               borderRadius: 10, padding: '8px 10px', minWidth: 62,
//             }}>
//               <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{hh}</div>
//               {wx && <div style={{ fontSize: 16, margin: '3px 0' }}>{getWeatherIcon(wx.weather[0]?.icon)}</div>}
//               <div style={{ fontSize: 14, fontWeight: 800, color: a.color, margin: '2px 0' }}>
//                 {Number(f.pm25_pred).toFixed(1)}
//               </div>
//               <div style={{ fontSize: 9, color: '#64748b' }}>µg/m³</div>
//               {wx && <div style={{ fontSize: 10, color: '#f97316', fontWeight: 600, marginTop: 2 }}>{Math.round(wx.main.temp)}°</div>}
//             </div>
//           )
//         })}
//       </div>
//     </div>
//   )
// }

// // Legend: bottom-right of map
// function MapLegend() {
//   return (
//     <div style={{
//       position: 'absolute', bottom: 28, right: 10, zIndex: 1000,
//       background: 'rgba(255,255,255,0.95)', borderRadius: 8,
//       padding: '7px 11px', border: '1px solid #d1fae5',
//       backdropFilter: 'blur(4px)', pointerEvents: 'none',
//     }}>
//       <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Qualité de l'air :</div>
//       {[
//         ['Bon',         '#22c55e', '< 15 µg/m³'],
//         ['Modéré',      '#f59e0b', '15–35 µg/m³'],
//         ['Mauvais',     '#ef4444', '35–75 µg/m³'],
//         ['Très mauvais','#a855f7', '> 75 µg/m³'],
//       ].map(([l, c, r]) => (
//         <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
//           <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
//           <span style={{ fontSize: 10, color: '#0f172a', fontWeight: 500 }}>{l}</span>
//           <span style={{ fontSize: 9, color: '#94a3b8' }}>({r})</span>
//         </div>
//       ))}
//     </div>
//   )
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // CITY PANEL
// // ─────────────────────────────────────────────────────────────────────────────
// function CityPanel({ city, forecast, fcLoading, currentWx, weather, onClose }) {
//   return (
//     <div style={{
//       flex: 1, minHeight: 0, overflowY: 'auto',
//       WebkitOverflowScrolling: 'touch',
//       borderTop: '1px solid #d1fae5',
//       padding: '12px 14px 24px',
//       background: '#fff',
//     }}>
//       {/* Header row */}
//       <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
//         <div>
//           <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{city}</div>
//           {forecast?.current_pm25 != null && (
//             <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
//               <span style={{ fontSize: 28, fontWeight: 900, color: getAQI(forecast.current_category)?.color }}>
//                 {Number(forecast.current_pm25).toFixed(1)}
//               </span>
//               <span style={{ fontSize: 12, color: '#94a3b8' }}>µg/m³ actuel</span>
//               <AqiBadge cat={forecast.current_category} size="lg" />
//             </div>
//           )}
//         </div>
//         <button onClick={onClose} style={{ padding: '5px 12px', fontSize: 11, color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>
//           ✕ Fermer
//         </button>
//       </div>

//       {/* Weather cards */}
//       {currentWx && (
//         <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
//           <WxCard icon={getWeatherIcon(currentWx.weather[0]?.icon)} label="Temps"     value={Math.round(currentWx.main.temp)} unit="°C" />
//           <WxCard icon="💧" label="Humidité"  value={currentWx.main.humidity} unit="%" />
//           <WxCard icon="💨" label="Vent"      value={Number(currentWx.wind.speed).toFixed(1)} unit="m/s" />
//           <WxCard icon="👁"  label="Visibilité" value={currentWx.visibility ? Math.round(currentWx.visibility / 1000) : '–'} unit="km" />
//         </div>
//       )}

//       {fcLoading && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement des prévisions...</div>}

//       {!fcLoading && forecast?.forecasts?.length > 0 && (
//         <>
//           <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>PRÉVISIONS HEURE PAR HEURE</div>
//           <div style={{ marginBottom: 14 }}>
//             <HourlyStrip forecasts={forecast.forecasts} weather={weather} />
//           </div>
//           <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>ÉVOLUTION PM2.5 + MÉTÉO</div>
//           <ForecastTimeline forecasts={forecast.forecasts} weather={weather?.list ?? []} />
//         </>
//       )}
//     </div>
//   )
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // RANKING PANEL
// // ─────────────────────────────────────────────────────────────────────────────
// function RankingPanel({ rankHorizon, setRankHorizon, rankData, rankLoading, selectedCity, onCityClick }) {
//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
//       <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
//         <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Prévision par horizon</span>
//         <select
//           value={rankHorizon}
//           onChange={e => setRankHorizon(Number(e.target.value))}
//           style={{ fontSize: 11, background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 6, padding: '3px 6px', color: '#065f46', fontWeight: 600, cursor: 'pointer' }}
//         >
//           {Array.from({ length: 24 }, (_, i) => i + 1).map(h => (
//             <option key={h} value={h}>H+{h}</option>
//           ))}
//         </select>
//       </div>
//       <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
//         {rankLoading && <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement...</div>}
//         {!rankLoading && rankData.map((d, i) => {
//           const a = getAQI(d.category)
//           return (
//             <button key={d.city} onClick={() => onCityClick(d.city)} style={{
//               width: '100%', display: 'flex', alignItems: 'center', gap: 8,
//               padding: '7px 12px', border: 'none', borderBottom: '1px solid #f8fffe',
//               background: d.city === selectedCity ? '#f0fdf4' : 'transparent',
//               cursor: 'pointer', textAlign: 'left',
//             }}>
//               <span style={{ fontSize: 10, color: '#94a3b8', width: 18, textAlign: 'right' }}>{i + 1}</span>
//               <div style={{ flex: 1, fontSize: 12, color: '#0f172a', fontWeight: d.city === selectedCity ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                 {d.city}
//               </div>
//               <div style={{ textAlign: 'right', marginRight: 4 }}>
//                 <div style={{ fontSize: 13, fontWeight: 800, color: a.color }}>{Number(d.pm25_pred).toFixed(1)}</div>
//                 <div style={{ fontSize: 9, color: '#94a3b8' }}>µg/m³</div>
//               </div>
//               <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
//             </button>
//           )
//         })}
//         {!rankLoading && !rankData.length && (
//           <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Aucune donnée</div>
//         )}
//       </div>
//     </div>
//   )
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // CITY LIST (H+1)
// // ─────────────────────────────────────────────────────────────────────────────
// function CityList({ sorted, loading, error, selectedCity, onCityClick }) {
//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
//       <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #e8fdf0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
//         <MapPin size={12} color="#48d99a" />
//         <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Classement H+1</span>
//       </div>
//       <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
//         {loading && <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement...</div>}
//         {error   && <div style={{ padding: 12, color: '#ef4444', fontSize: 11 }}>{error}</div>}
//         {sorted.map((d, i) => {
//           const a = getAQI(d.category)
//           const isActive = d.city === selectedCity
//           return (
//             <button key={d.city} onClick={() => onCityClick(d.city)} style={{
//               width: '100%', display: 'flex', alignItems: 'center', gap: 8,
//               padding: '8px 12px', border: 'none', borderBottom: '1px solid #f0fdf4',
//               background: isActive ? '#f0fdf4' : 'transparent',
//               borderLeft: isActive ? '3px solid #48d99a' : '3px solid transparent',
//               cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
//             }}>
//               <span style={{ fontSize: 10, color: '#94a3b8', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
//               <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
//               <span style={{ flex: 1, fontSize: 12, color: '#0f172a', fontWeight: isActive ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                 {d.city}
//               </span>
//               <span style={{ fontSize: 12, fontWeight: 700, color: a.color, flexShrink: 0 }}>
//                 {Number(d.pm25_pred).toFixed(1)}
//               </span>
//             </button>
//           )
//         })}
//       </div>
//     </div>
//   )
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // useIsMobile
// // ─────────────────────────────────────────────────────────────────────────────
// function useIsMobile() {
//   const [v, setV] = useState(window.innerWidth < 768)
//   useEffect(() => {
//     const h = () => setV(window.innerWidth < 768)
//     window.addEventListener('resize', h)
//     return () => window.removeEventListener('resize', h)
//   }, [])
//   return v
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // DASHBOARD
// // ─────────────────────────────────────────────────────────────────────────────
// export default function Dashboard() {
//   const [city, setCity]               = useState(null)
//   const [weather, setWeather]         = useState(null)
//   const [rankHorizon, setRankHorizon] = useState(1)
//   const [rankData, setRankData]       = useState([])
//   const [rankLoading, setRankLoading] = useState(false)
//   const [mobileTab, setMobileTab]     = useState('map')
//   const [cityPanelOpen, setCityPanelOpen] = useState(false)

//   const isMobile = useIsMobile()
//   const { data, loading, lastUpdate, refresh, error } = useMapData()
//   const { data: forecast, loading: fcLoading }        = useCityForecast(city)
//   const now = useClock()

//   const sorted = [...data].sort((a, b) => b.pm25_pred - a.pm25_pred)

//   const stats = data.length ? {
//     cities: data.length,
//     avg:    data.reduce((s, d) => s + d.pm25_pred, 0) / data.length,
//     good:   data.filter(d => d.pm25_pred < 15).length,
//     bad:    data.filter(d => d.pm25_pred >= 35).length,
//   } : null

//   // Fetch ranking on horizon change
//   useEffect(() => {
//     setRankLoading(true)
//     getRanking(rankHorizon)
//       .then(r => setRankData(r.ranking || []))
//       .catch(() => setRankData([]))
//       .finally(() => setRankLoading(false))
//   }, [rankHorizon])

//   // Fetch weather when city changes
//   useEffect(() => {
//     if (!city || !data.length) return
//     const cd = data.find(d => d.city === city)
//     if (!cd) return
//     fetch(`/api/weather/forecast?lat=${cd.lat}&lon=${cd.lon}`)
//       .then(r => r.json())
//       .then(d => setWeather(d))
//       .catch(() => setWeather(null))
//   }, [city])

//   const handleCityClick = useCallback((c) => {
//     const next = c === city ? null : c
//     setCity(next)
//     if (next) { setCityPanelOpen(true); if (isMobile) setMobileTab('map') }
//     else       { setCityPanelOpen(false) }
//   }, [city, isMobile])

//   const handleClose = useCallback(() => { setCity(null); setCityPanelOpen(false) }, [])

//   const currentWx = weather?.list?.[0]
//   const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
//   const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

//   // Shared props bundles
//   const cityPanelProps  = { city, forecast, fcLoading, currentWx, weather, onClose: handleClose }
//   const rankingProps    = { rankHorizon, setRankHorizon, rankData, rankLoading, selectedCity: city, onCityClick: handleCityClick }
//   const cityListProps   = { sorted, loading, error, selectedCity: city, onCityClick: handleCityClick }

//   // ── MOBILE ────────────────────────────────────────────────────────────────
//   if (isMobile) {
//     return (
//       <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fffe', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

//         {/* Header */}
//         <header style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//             <div style={{ width: 30, height: 30, background: '#b8ffd9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🌿</div>
//             <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>Air Qualité Maroc</div>
//           </div>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//             {stats && (
//               <div style={{ fontSize: 11 }}>
//                 Moy. <span style={{ fontWeight: 700, color: stats.avg > 35 ? '#ef4444' : stats.avg > 15 ? '#f59e0b' : '#22c55e' }}>{stats.avg.toFixed(1)} µg/m³</span>
//               </div>
//             )}
//             <div style={{ textAlign: 'right' }}>
//               <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</div>
//               <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'capitalize' }}>{dateStr}</div>
//             </div>
//             <button onClick={refresh} style={{ background: '#b8ffd9', border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
//               <RefreshCw size={13} color="#065f46" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
//             </button>
//           </div>
//         </header>

//         {/* Tabs — no emojis */}
//         <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5', display: 'flex' }}>
//           {[['map', 'Carte'], ['list', 'Villes H+1'], ['ranking', 'Horizon']].map(([tab, label]) => (
//             <button key={tab}
//               onClick={() => { setMobileTab(tab); if (tab !== 'map') setCityPanelOpen(false) }}
//               style={{
//                 flex: 1, padding: '11px 4px', border: 'none', cursor: 'pointer',
//                 fontSize: 12, fontWeight: mobileTab === tab ? 700 : 400,
//                 color: mobileTab === tab ? '#065f46' : '#64748b',
//                 background: mobileTab === tab ? '#f0fdf4' : '#fff',
//                 borderBottom: mobileTab === tab ? '2px solid #48d99a' : '2px solid transparent',
//               }}
//             >{label}</button>
//           ))}
//         </div>

//         {/* Content */}
//         <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

//           {/* MAP TAB */}
//           {mobileTab === 'map' && (
//             <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
//               {/* Map zone */}
//               <div style={{ flex: cityPanelOpen ? '0 0 40%' : 1, minHeight: 0, position: 'relative', padding: '6px' }}>
//                 <div style={{ height: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid #d1fae5', position: 'relative' }}>
//                   <MapView data={data} onCityClick={handleCityClick} selectedCity={city} />
//                   <MapLegend />
//                 </div>
//               </div>

//               {/* City drawer */}
//               {city && (
//                 <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
//                   {/* Handle */}
//                   <div
//                     onClick={() => setCityPanelOpen(v => !v)}
//                     style={{ padding: '8px 14px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexShrink: 0, borderTop: '1px solid #d1fae5' }}
//                   >
//                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//                       <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{city}</span>
//                       {forecast?.current_pm25 != null && (
//                         <span style={{ fontSize: 12, fontWeight: 800, color: getAQI(forecast.current_category)?.color }}>
//                           {Number(forecast.current_pm25).toFixed(1)} µg/m³
//                         </span>
//                       )}
//                     </div>
//                     {cityPanelOpen ? <ChevronDown size={16} color="#48d99a" /> : <ChevronUp size={16} color="#48d99a" />}
//                   </div>
//                   {cityPanelOpen && <CityPanel {...cityPanelProps} />}
//                 </div>
//               )}
//             </div>
//           )}

//           {mobileTab === 'list' && (
//             <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
//               <CityList {...cityListProps} />
//             </div>
//           )}

//           {mobileTab === 'ranking' && (
//             <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
//               <RankingPanel {...rankingProps} />
//             </div>
//           )}
//         </div>

//         <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
//       </div>
//     )
//   }

//   // ── DESKTOP ───────────────────────────────────────────────────────────────
//   return (
//     <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fffe', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

//       {/* Header */}
//       <header style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//           <div style={{ width: 36, height: 36, background: '#b8ffd9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌿</div>
//           <div>
//             <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Air Qualité Maroc</div>
//             <div style={{ fontSize: 11, color: '#64748b' }}>PM2.5 · Prévisions 24h</div>
//           </div>
//         </div>
//         <div style={{ textAlign: 'center' }}>
//           <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{timeStr}</div>
//           <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{dateStr}</div>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//           {stats && (
//             <>
//               <StatPill label="Villes actives" value={stats.cities} />
//               <StatPill label="Moy. PM2.5" value={`${stats.avg.toFixed(1)} µg/m³`} color={stats.avg > 35 ? '#ef4444' : stats.avg > 15 ? '#f59e0b' : '#22c55e'} />
//               <StatPill label="Qualité bonne" value={`${stats.good} villes`} color="#22c55e" />
//               <StatPill label="Qualité mauvaise" value={`${stats.bad} villes`} color={stats.bad > 0 ? '#ef4444' : '#0f172a'} />
//             </>
//           )}
//           <button onClick={refresh} style={{ background: '#b8ffd9', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#065f46', fontWeight: 600 }}>
//             <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
//             Actualiser
//           </button>
//           {lastUpdate && <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>Maj {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>}
//         </div>
//       </header>

//       {/* Body */}
//       <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

//         {/* Left */}
//         <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #e8fdf0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
//           <CityList {...cityListProps} />
//         </div>

//         {/* Center */}
//         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
//           <div style={{ flex: city ? '0 0 52%' : '1', padding: '10px 10px 6px', minHeight: 0, position: 'relative' }}>
//             <div style={{ height: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #d1fae5', position: 'relative' }}>
//               <MapView data={data} onCityClick={handleCityClick} selectedCity={city} />
//               <MapLegend />
//             </div>
//           </div>
//           {city && <CityPanel {...cityPanelProps} />}
//         </div>

//         {/* Right */}
//         <div style={{ width: 260, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e8fdf0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
//           <RankingPanel {...rankingProps} />
//           <div style={{ padding: '8px 12px', borderTop: '1px solid #f0fdf4', background: '#f8fffe', flexShrink: 0 }}>
//             <div style={{ fontSize: 9, color: '#94a3b8' }}>Données : OpenWeatherMap · Actua. 5 min</div>
//           </div>
//         </div>
//       </div>

//       <style>{`
//         @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
//         button:hover { opacity: 0.88 }
//         ::-webkit-scrollbar { width: 4px; height: 4px; }
//         ::-webkit-scrollbar-track { background: #f8fffe; }
//         ::-webkit-scrollbar-thumb { background: #b8ffd9; border-radius: 2px; }
//       `}</style>
//     </div>
//   )
// }



import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import MapView from '../components/MapView'
import ForecastTimeline from '../components/ForecastTimeline'
import { useMapData, useCityForecast, useClock } from '../hooks/usePredictions'
import { getAQI } from '../utils/aqi'
import { getWeatherIcon } from '../utils/weather'
import { getRanking } from '../utils/api'

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER COMPONENTS  (defined outside Dashboard → never remounted)
// ─────────────────────────────────────────────────────────────────────────────

function AqiBadge({ cat, size = 'sm' }) {
  const a = getAQI(cat)
  return (
    <span style={{
      background: a.bg, color: a.text, border: `1px solid ${a.border}`,
      borderRadius: 20, padding: size === 'lg' ? '6px 14px' : '3px 10px',
      fontSize: size === 'lg' ? 13 : 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{cat}</span>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', minWidth: 90 }}>
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
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
        {value}<span style={{ fontSize: 11, color: '#64748b', marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{label}</div>
    </div>
  )
}

function HourlyStrip({ forecasts, weather }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
        {(forecasts || []).map((f, i) => {
          const dt = new Date(f.datetime)
          const hh = String(dt.getHours()).padStart(2, '0') + ':00'
          const a = getAQI(f.category)
          const wx = weather?.list?.find(w => Math.abs(new Date(w.dt * 1000) - dt) < 90 * 60 * 1000)
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
              {wx && <div style={{ fontSize: 10, color: '#f97316', fontWeight: 600, marginTop: 2 }}>{Math.round(wx.main.temp)}°</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Legend: bottom-right of map
function MapLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: 28, right: 10, zIndex: 1000,
      background: 'rgba(255,255,255,0.95)', borderRadius: 8,
      padding: '7px 11px', border: '1px solid #d1fae5',
      backdropFilter: 'blur(4px)', pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Qualité de l'air :</div>
      {[
        ['Bon',         '#22c55e', '< 15 µg/m³'],
        ['Modéré',      '#f59e0b', '15–35 µg/m³'],
        ['Mauvais',     '#ef4444', '35–75 µg/m³'],
        ['Très mauvais','#a855f7', '> 75 µg/m³'],
      ].map(([l, c, r]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#0f172a', fontWeight: 500 }}>{l}</span>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>({r})</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CityPanel({ city, forecast, fcLoading, currentWx, weather, onClose }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      borderTop: '1px solid #d1fae5',
      padding: '12px 14px 24px',
      background: '#fff',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{city}</div>
          {forecast?.current_pm25 != null && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: getAQI(forecast.current_category)?.color }}>
                {Number(forecast.current_pm25).toFixed(1)}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>µg/m³ actuel</span>
              <AqiBadge cat={forecast.current_category} size="lg" />
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ padding: '5px 12px', fontSize: 11, color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>
          ✕ Fermer
        </button>
      </div>

      {/* Weather cards */}
      {currentWx && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <WxCard icon={getWeatherIcon(currentWx.weather[0]?.icon)} label="Temps"     value={Math.round(currentWx.main.temp)} unit="°C" />
          <WxCard icon="💧" label="Humidité"  value={currentWx.main.humidity} unit="%" />
          <WxCard icon="💨" label="Vent"      value={Number(currentWx.wind.speed).toFixed(1)} unit="m/s" />
          <WxCard icon="👁"  label="Visibilité" value={currentWx.visibility ? Math.round(currentWx.visibility / 1000) : '–'} unit="km" />
        </div>
      )}

      {fcLoading && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement des prévisions...</div>}

      {!fcLoading && forecast?.forecasts?.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>PRÉVISIONS HEURE PAR HEURE</div>
          <div style={{ marginBottom: 14 }}>
            <HourlyStrip forecasts={forecast.forecasts} weather={weather} />
          </div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>ÉVOLUTION PM2.5 + MÉTÉO</div>
          <ForecastTimeline forecasts={forecast.forecasts} weather={weather?.list ?? []} />
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKING PANEL
// ─────────────────────────────────────────────────────────────────────────────
function RankingPanel({ rankHorizon, setRankHorizon, rankData, rankLoading, selectedCity, onCityClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Prévision par horizon</span>
        <select
          value={rankHorizon}
          onChange={e => setRankHorizon(Number(e.target.value))}
          style={{ fontSize: 11, background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 6, padding: '3px 6px', color: '#065f46', fontWeight: 600, cursor: 'pointer' }}
        >
          {Array.from({ length: 24 }, (_, i) => i + 1).map(h => (
            <option key={h} value={h}>H+{h}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        {rankLoading && <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement...</div>}
        {!rankLoading && rankData.map((d, i) => {
          const a = getAQI(d.category)
          return (
            <button key={d.city} onClick={() => onCityClick(d.city)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', border: 'none', borderBottom: '1px solid #f8fffe',
              background: d.city === selectedCity ? '#f0fdf4' : 'transparent',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 10, color: '#94a3b8', width: 18, textAlign: 'right' }}>{i + 1}</span>
              <div style={{ flex: 1, fontSize: 12, color: '#0f172a', fontWeight: d.city === selectedCity ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.city}
              </div>
              <div style={{ textAlign: 'right', marginRight: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: a.color }}>{Number(d.pm25_pred).toFixed(1)}</div>
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
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY LIST (H+1)
// ─────────────────────────────────────────────────────────────────────────────
function CityList({ sorted, loading, error, selectedCity, onCityClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #e8fdf0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <MapPin size={12} color="#48d99a" />
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Classement H+1</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        {loading && <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement...</div>}
        {error   && <div style={{ padding: 12, color: '#ef4444', fontSize: 11 }}>{error}</div>}
        {sorted.map((d, i) => {
          const a = getAQI(d.category)
          const isActive = d.city === selectedCity
          return (
            <button key={d.city} onClick={() => onCityClick(d.city)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', border: 'none', borderBottom: '1px solid #f0fdf4',
              background: isActive ? '#f0fdf4' : 'transparent',
              borderLeft: isActive ? '3px solid #48d99a' : '3px solid transparent',
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
            }}>
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
}

// ─────────────────────────────────────────────────────────────────────────────
// useIsMobile
// ─────────────────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [v, setV] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setV(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return v
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [city, setCity]               = useState(null)
  const [weather, setWeather]         = useState(null)
  const [rankHorizon, setRankHorizon] = useState(1)
  const [rankData, setRankData]       = useState([])
  const [rankLoading, setRankLoading] = useState(false)
  const [mobileTab, setMobileTab]     = useState('map')
  const [cityPanelOpen, setCityPanelOpen] = useState(false)

  const isMobile = useIsMobile()
  const { data, loading, lastUpdate, refresh, error } = useMapData()
  const { data: forecast, loading: fcLoading }        = useCityForecast(city)
  const now = useClock()

  const sorted = [...data].sort((a, b) => b.pm25_pred - a.pm25_pred)

  const stats = data.length ? {
    cities: data.length,
    avg:    data.reduce((s, d) => s + d.pm25_pred, 0) / data.length,
    good:   data.filter(d => d.pm25_pred < 15).length,
    bad:    data.filter(d => d.pm25_pred >= 35).length,
  } : null

  // Fetch ranking on horizon change
  useEffect(() => {
    setRankLoading(true)
    getRanking(rankHorizon)
      .then(r => setRankData(r.ranking || []))
      .catch(() => setRankData([]))
      .finally(() => setRankLoading(false))
  }, [rankHorizon])

  // Fetch weather when city changes
  useEffect(() => {
    if (!city || !data.length) return
    const cd = data.find(d => d.city === city)
    if (!cd) return
    fetch(`/api/weather/forecast?lat=${cd.lat}&lon=${cd.lon}`)
      .then(r => r.json())
      .then(d => setWeather(d))
      .catch(() => setWeather(null))
  }, [city])

  const handleCityClick = useCallback((c) => {
    const next = c === city ? null : c
    setCity(next)
    if (next) { setCityPanelOpen(true); if (isMobile) setMobileTab('map') }
    else       { setCityPanelOpen(false) }
  }, [city, isMobile])

  const handleClose = useCallback(() => { setCity(null); setCityPanelOpen(false) }, [])

  const currentWx = weather?.list?.[0]
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // When a horizon > 1 is selected, use rankData for the map (enriched with lat/lon from base data)
  const mapData = rankHorizon === 1 ? data : rankData.map(r => {
    const base = data.find(d => d.city === r.city)
    return base ? { ...base, ...r } : r
  })

  // Shared props bundles
  const cityPanelProps  = { city, forecast, fcLoading, currentWx, weather, onClose: handleClose }
  const rankingProps    = { rankHorizon, setRankHorizon, rankData, rankLoading, selectedCity: city, onCityClick: handleCityClick }
  const cityListProps   = { sorted, loading, error, selectedCity: city, onCityClick: handleCityClick }

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fffe', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

        {/* Header */}
        <header style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, background: '#b8ffd9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🌿</div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>Air Qualité Maroc</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {stats && (
              <div style={{ fontSize: 11 }}>
                Moy. <span style={{ fontWeight: 700, color: stats.avg > 35 ? '#ef4444' : stats.avg > 15 ? '#f59e0b' : '#22c55e' }}>{stats.avg.toFixed(1)} µg/m³</span>
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</div>
              <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'capitalize' }}>{dateStr}</div>
            </div>
            <button onClick={refresh} style={{ background: '#b8ffd9', border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={13} color="#065f46" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </header>

        {/* Tabs — no emojis */}
        <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5', display: 'flex' }}>
          {[['map', 'Carte'], ['list', 'Villes H+1'], ['ranking', 'Horizon']].map(([tab, label]) => (
            <button key={tab}
              onClick={() => { setMobileTab(tab); if (tab !== 'map') setCityPanelOpen(false) }}
              style={{
                flex: 1, padding: '11px 4px', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: mobileTab === tab ? 700 : 400,
                color: mobileTab === tab ? '#065f46' : '#64748b',
                background: mobileTab === tab ? '#f0fdf4' : '#fff',
                borderBottom: mobileTab === tab ? '2px solid #48d99a' : '2px solid transparent',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* MAP TAB */}
          {mobileTab === 'map' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Map zone */}
              <div style={{ flex: cityPanelOpen ? '0 0 40%' : 1, minHeight: 0, position: 'relative', padding: '6px' }}>
                <div style={{ height: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid #d1fae5', position: 'relative' }}>
                  {rankHorizon > 1 && (
                    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: '#0f172a', color: '#b8ffd9', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>
                      Carte H+{rankHorizon}
                    </div>
                  )}
                  <MapView data={mapData} onCityClick={handleCityClick} selectedCity={city} />
                  <MapLegend />
                </div>
              </div>

              {/* City drawer */}
              {city && (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  {/* Handle */}
                  <div
                    onClick={() => setCityPanelOpen(v => !v)}
                    style={{ padding: '8px 14px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexShrink: 0, borderTop: '1px solid #d1fae5' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{city}</span>
                      {forecast?.current_pm25 != null && (
                        <span style={{ fontSize: 12, fontWeight: 800, color: getAQI(forecast.current_category)?.color }}>
                          {Number(forecast.current_pm25).toFixed(1)} µg/m³
                        </span>
                      )}
                    </div>
                    {cityPanelOpen ? <ChevronDown size={16} color="#48d99a" /> : <ChevronUp size={16} color="#48d99a" />}
                  </div>
                  {cityPanelOpen && <CityPanel {...cityPanelProps} />}
                </div>
              )}
            </div>
          )}

          {mobileTab === 'list' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <CityList {...cityListProps} />
            </div>
          )}

          {mobileTab === 'ranking' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <RankingPanel {...rankingProps} />
            </div>
          )}
        </div>

        <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fffe', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #d1fae5', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#b8ffd9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌿</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Air Qualité Maroc</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>PM2.5 · Prévisions 24h</div>
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
          <button onClick={refresh} style={{ background: '#b8ffd9', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#065f46', fontWeight: 600 }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </button>
          {lastUpdate && <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>Maj {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>}
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left */}
        <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #e8fdf0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CityList {...cityListProps} />
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: city ? '0 0 52%' : '1', padding: '10px 10px 6px', minHeight: 0, position: 'relative' }}>
            <div style={{ height: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #d1fae5', position: 'relative' }}>
              {/* Horizon badge overlay */}
              {rankHorizon > 1 && (
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: '#0f172a', color: '#b8ffd9', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>
                  Carte H+{rankHorizon}
                </div>
              )}
              <MapView data={mapData} onCityClick={handleCityClick} selectedCity={city} />
              <MapLegend />
            </div>
          </div>
          {city && <CityPanel {...cityPanelProps} />}
        </div>

        {/* Right */}
        <div style={{ width: 260, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e8fdf0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <RankingPanel {...rankingProps} />
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f0fdf4', background: '#f8fffe', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>Données : OpenWeatherMap · Actua. 5 min</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        button:hover { opacity: 0.88 }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f8fffe; }
        ::-webkit-scrollbar-thumb { background: #b8ffd9; border-radius: 2px; }
      `}</style>
    </div>
  )
}