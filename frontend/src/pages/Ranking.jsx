import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { useRanking } from '../hooks/usePredictions'
import { AQI_BADGE } from '../utils/aqi'

export default function Ranking() {
  const [horizon, setHorizon] = useState(1)
  const { data, loading } = useRanking(horizon)

  return (
    <div className="min-h-screen bg-dark p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy size={20} className="text-yellow-400" />
            <h1 className="text-xl font-bold text-white">Classement PM2.5</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Horizon :</span>
            <select
              value={horizon}
              onChange={e => setHorizon(Number(e.target.value))}
              className="bg-card border border-border text-white text-sm rounded-lg px-3 py-1.5 outline-none"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map(h => (
                <option key={h} value={h}>H+{h}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-600 py-16">Chargement...</div>
        ) : (
          <div className="space-y-2">
            {data.map((d, i) => (
              <div
                key={d.city}
                className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3 hover:border-gray-600 transition-colors"
              >
                <span className="w-7 text-center font-bold text-gray-500 text-sm shrink-0">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </span>
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: d.color }}
                />
                <span className="flex-1 text-white font-medium text-sm">{d.city}</span>
                <span className="font-bold text-base shrink-0" style={{ color: d.color }}>
                  {Number(d.pm25_pred).toFixed(1)}
                  <span className="text-xs text-gray-500 font-normal ml-1">µg/m³</span>
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${AQI_BADGE[d.category] ?? ''}`}>
                  {d.category}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
