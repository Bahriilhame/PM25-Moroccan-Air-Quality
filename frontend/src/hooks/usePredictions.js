import { useState, useEffect, useCallback } from 'react'
import { getMapH1, getCityForecast, getRanking, getHealth } from '../utils/api'

export function useMapData(pollMs = 5 * 60 * 1000) {
  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
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
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!city) { setData(null); return }
    setLoading(true)
    getCityForecast(city)
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [city])

  return { data, loading, error }
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

export function useHealth() {
  const [data, setData] = useState(null)
  useEffect(() => {
    getHealth().then(setData).catch(() => {})
    const id = setInterval(() => getHealth().then(setData).catch(() => {}), 30000)
    return () => clearInterval(id)
  }, [])
  return data
}
