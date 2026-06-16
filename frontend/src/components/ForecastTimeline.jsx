import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from 'recharts'

const THRESHOLDS = [
  { y: 15, label: 'Modéré', color: '#f59e0b' },
  { y: 35, label: 'Mauvais', color: '#ef4444' },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const pm = payload.find(p => p.dataKey === 'pm25')
  const temp = payload.find(p => p.dataKey === 'temp')
  const hum = payload.find(p => p.dataKey === 'humidity')
  const wind = payload.find(p => p.dataKey === 'wind')

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      fontSize: 12,
      minWidth: 140,
    }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6, fontSize: 13 }}>{label}</div>
      {pm && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
          <span style={{ color: '#64748b' }}>PM2.5</span>
          <span style={{ fontWeight: 700, color: pm.value > 35 ? '#ef4444' : pm.value > 15 ? '#f59e0b' : '#22c55e' }}>
            {Number(pm.value).toFixed(1)} µg/m³
          </span>
        </div>
      )}
      {temp && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
          <span style={{ color: '#64748b' }}>Temp.</span>
          <span style={{ fontWeight: 600, color: '#f97316' }}>{Number(temp.value).toFixed(1)}°C</span>
        </div>
      )}
      {hum && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
          <span style={{ color: '#64748b' }}>Humidité</span>
          <span style={{ fontWeight: 600, color: '#3b82f6' }}>{Math.round(hum.value)}%</span>
        </div>
      )}
      {wind && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#64748b' }}>Vent</span>
          <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{Number(wind.value).toFixed(1)} m/s</span>
        </div>
      )}
    </div>
  )
}

export default function ForecastTimeline({ forecasts = [], weather = [] }) {
  const now = new Date()
  const nowHour = now.getHours()

  // Merge PM2.5 forecasts avec météo
  const data = forecasts.map((f, i) => {
    const dt = new Date(f.datetime)
    const hLabel = `${String(dt.getHours()).padStart(2, '0')}:00`
    const isPast = dt < now

    // Trouver météo correspondante (OWM donne toutes les 3h)
    const wx = weather.find(w => {
      const wDt = new Date(w.dt * 1000)
      return Math.abs(wDt - dt) < 2 * 60 * 60 * 1000
    })

    return {
      label: hLabel,
      horizon: f.horizon_h,
      pm25: Number(f.pm25_pred),
      category: f.category,
      color: f.color,
      temp: wx?.main?.temp ?? null,
      humidity: wx?.main?.humidity ?? null,
      wind: wx?.wind?.speed ?? null,
      isPast,
      isNow: Math.abs(dt - now) < 30 * 60 * 1000,
    }
  })

  if (!data.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8', fontSize: 13 }}>
      Données non disponibles
    </div>
  )

  const maxPM = Math.max(...data.map(d => d.pm25), 40)

  return (
    <div>
      {/* Légende compacte */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 3, background: '#b8ffd9', borderRadius: 2, display: 'inline-block' }} />
          PM2.5 (µg/m³)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 3, background: '#f97316', borderRadius: 2, display: 'inline-block', borderTop: '2px dashed #f97316', height: 0 }} />
          Température
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 3, background: '#3b82f6', borderRadius: 2, display: 'inline-block', borderTop: '2px dotted #3b82f6', height: 0 }} />
          Humidité %
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="pmGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#b8ffd9" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#b8ffd9" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            yAxisId="pm"
            domain={[0, maxPM + 10]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="wx"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            hide
          />
          <Tooltip content={<CustomTooltip />} />
          {THRESHOLDS.map(t => (
            <ReferenceLine
              key={t.y} yAxisId="pm" y={t.y}
              stroke={t.color} strokeDasharray="4 3" strokeOpacity={0.5}
              label={{ value: t.label, fill: t.color, fontSize: 9, position: 'insideTopLeft' }}
            />
          ))}
          <Area
            yAxisId="pm" type="monotone" dataKey="pm25"
            stroke="#48d99a" strokeWidth={2}
            fill="url(#pmGrad)" dot={false}
            activeDot={{ r: 4, fill: '#48d99a', stroke: '#fff', strokeWidth: 2 }}
          />
          {data[0]?.temp !== null && (
            <Line
              yAxisId="wx" type="monotone" dataKey="temp"
              stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2"
              dot={false} activeDot={false}
            />
          )}
          {data[0]?.humidity !== null && (
            <Line
              yAxisId="wx" type="monotone" dataKey="humidity"
              stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="2 2"
              dot={false} activeDot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
