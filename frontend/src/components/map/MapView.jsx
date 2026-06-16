import { useEffect, useRef } from 'react'
import L from 'leaflet'

export default function MapView({ data = [], onCityClick }) {
  const mapRef     = useRef(null)
  const mapInst    = useRef(null)
  const layerRef   = useRef(null)

  useEffect(() => {
    if (mapInst.current) return
    mapInst.current = L.map(mapRef.current, {
      center: [31.5, -6.5],
      zoom: 6,
      zoomControl: true,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(mapInst.current)
    L.control.attribution({ prefix: '© OpenStreetMap © CARTO' }).addTo(mapInst.current)
  }, [])

  useEffect(() => {
    if (!mapInst.current || !data.length) return
    if (layerRef.current) layerRef.current.clearLayers()

    const layer = L.layerGroup()
    data.forEach(d => {
      const color = d.color || '#95A5A6'
      const r     = d.pm25_pred > 75 ? 22 : d.pm25_pred > 35 ? 17 : d.pm25_pred > 15 ? 13 : 10

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${r*2}px;height:${r*2}px;
          background:${color};
          border-radius:50%;
          border:2.5px solid rgba(255,255,255,0.75);
          box-shadow:0 0 ${r*1.5}px ${color}80;
          cursor:pointer;
        "></div>`,
        iconSize: [r*2, r*2],
        iconAnchor: [r, r],
      })

      const m = L.marker([d.lat, d.lon], { icon })
      m.bindPopup(`
        <div style="min-width:150px;font-family:system-ui">
          <div style="font-size:15px;font-weight:700;margin-bottom:4px">${d.city}</div>
          <div style="font-size:22px;font-weight:800;color:${color};line-height:1.2">
            ${Number(d.pm25_pred).toFixed(1)} <span style="font-size:12px;font-weight:400;color:#aaa">µg/m³</span>
          </div>
          <div style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:20px;
            background:${color}22;color:${color};font-size:11px;border:1px solid ${color}44">
            ${d.category}
          </div>
          <div style="margin-top:6px;font-size:11px;color:#888">
            Confiance : ${Math.round(d.confidence * 100)}%
          </div>
        </div>
      `)
      m.on('click', () => onCityClick?.(d.city))
      layer.addLayer(m)
    })

    layer.addTo(mapInst.current)
    layerRef.current = layer
  }, [data, onCityClick])

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}
    />
  )
}
