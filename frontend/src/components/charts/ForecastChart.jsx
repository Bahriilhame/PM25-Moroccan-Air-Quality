import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Dot
} from 'recharts'

const REFS = [
  { y: 15, color: '#F39C12', label: '15' },
  { y: 35, color: '#E74C3C', label: '35' },
  { y: 75, color: '#8E44AD', label: '75' },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-2xl text-sm">
      <div className="font-bold text-white mb-1">H+{d.horizon_h}</div>
      <div className="text-xl font-bold" style={{ color: d.color }}>
        {Number(d.pm25_pred).toFixed(1)}
        <span className="text-xs text-gray-400 font-normal ml-1">µg/m³</span>
      </div>
      <div className="mt-1 text-gray-400">{d.category}</div>
      <div className="text-gray-600 text-xs">Confiance {Math.round(d.confidence * 100)}%</div>
    </div>
  )
}

export default function ForecastChart({ forecasts = [] }) {
  if (!forecasts.length)
    return <div className="flex items-center justify-center h-52 text-gray-600 text-sm">Aucune prévision</div>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={forecasts} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" />
        <XAxis
          dataKey="horizon_h" tickFormatter={v => `+${v}h`}
          tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={{ stroke: '#2A2D3E' }} tickLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false}
          tickFormatter={v => v}
        />
        <Tooltip content={<CustomTooltip />} />
        {REFS.map(r => (
          <ReferenceLine key={r.y} y={r.y} stroke={r.color} strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: r.label, fill: r.color, fontSize: 9, position: 'insideTopRight' }}
          />
        ))}
        <Area type="monotone" dataKey="pm25_pred" stroke="#3B82F6" strokeWidth={2}
          fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
