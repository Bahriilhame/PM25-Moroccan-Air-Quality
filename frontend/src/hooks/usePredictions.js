import { useState, useEffect, useCallback } from 'react'
import { getMapH1, getCityForecast, getRanking } from '../utils/api'

export function useMapData(pollMs = 5 * 60 * 1000) {
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await getMapH1()
      setData(res.data || [])
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, pollMs)
    return () => clearInterval(id)
  }, [load, pollMs])

  return { data, loading, error, lastUpdate, refresh: load }
}

export function useCityForecast(city) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!city) { setData(null); return }
    setLoading(true)
    getCityForecast(city)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [city])

  return { data, loading }
}

export function useRanking(horizon = 1) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getRanking(horizon)
      .then(r => setData(r.ranking || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [horizon])

  return { data, loading }
}

export function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function useWeatherForecast(lat, lon) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!lat || !lon) return
    setLoading(true)
    // Appel OWM via backend proxy /api/weather ou directement si clé publique
    // On utilise l'endpoint backend pour ne pas exposer la clé
    fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lat, lon])

  return { data, loading }
}
