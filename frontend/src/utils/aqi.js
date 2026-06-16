export const AQI_COLORS = {
  'Bon':          '#2ECC71',
  'Modéré':       '#F39C12',
  'Mauvais':      '#E74C3C',
  'Très mauvais': '#8E44AD',
}

export const AQI_BADGE = {
  'Bon':          'bg-green-500/20  text-green-400  border-green-500/40',
  'Modéré':       'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  'Mauvais':      'bg-red-500/20    text-red-400    border-red-500/40',
  'Très mauvais': 'bg-purple-500/20 text-purple-400 border-purple-500/40',
}

export function getCategory(pm25) {
  if (pm25 < 15) return 'Bon'
  if (pm25 < 35) return 'Modéré'
  if (pm25 < 75) return 'Mauvais'
  return 'Très mauvais'
}

export function getColor(pm25) {
  return AQI_COLORS[getCategory(pm25)] ?? '#95A5A6'
}
