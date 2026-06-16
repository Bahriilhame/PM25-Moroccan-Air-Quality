export const AQI = {
  'Bon':          { color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  'Modéré':       { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  'Mauvais':      { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  'Très mauvais': { color: '#a855f7', bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' },
}

export function getCategory(pm25) {
  if (pm25 < 15) return 'Bon'
  if (pm25 < 35) return 'Modéré'
  if (pm25 < 75) return 'Mauvais'
  return 'Très mauvais'
}

export function getAQI(cat) {
  return AQI[cat] ?? { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', text: '#475569' }
}
