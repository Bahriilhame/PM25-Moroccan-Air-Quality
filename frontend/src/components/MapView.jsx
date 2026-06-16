import { useEffect, useRef } from 'react'
import L from 'leaflet'

export default function MapView({ data = [], onCityClick, selectedCity }) {
  const mapRef   = useRef(null)
  const mapInst  = useRef(null)
  const layerRef = useRef(null)

  useEffect(() => {
    if (mapInst.current) return
    mapInst.current = L.map(mapRef.current, {
      center: [31.5, -6.5],
      zoom: 6,
      zoomControl: true,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(mapInst.current)
    L.control.attribution({ prefix: '© OpenStreetMap © CARTO' }).addTo(mapInst.current)
  }, [])

  useEffect(() => {
    if (!mapInst.current || !data.length) return
    if (layerRef.current) layerRef.current.clearLayers()

    const layer = L.layerGroup()
    data.forEach(d => {
      const color = d.color || '#94a3b8'
      const isSelected = d.city === selectedCity
      const r = d.pm25_pred > 75 ? 18 : d.pm25_pred > 35 ? 14 : d.pm25_pred > 15 ? 11 : 8
      const size = isSelected ? r + 4 : r

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size*2}px;height:${size*2}px;
          background:${color};
          border-radius:50%;
          border:${isSelected ? '3px solid #0f172a' : '2px solid rgba(255,255,255,0.9)'};
          box-shadow:0 2px 8px ${color}60;
          cursor:pointer;
          transition:all 0.2s;
        "></div>`,
        iconSize: [size*2, size*2],
        iconAnchor: [size, size],
      })

      const m = L.marker([d.lat, d.lon], { icon, zIndexOffset: isSelected ? 1000 : 0 })
      m.bindPopup(`
        <div style="min-width:160px;font-family:system-ui;padding:4px 0">
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px">${d.city}</div>
          <div style="font-size:26px;font-weight:800;color:${color};line-height:1.1">
            ${Number(d.pm25_pred).toFixed(1)}<span style="font-size:12px;font-weight:400;color:#64748b;margin-left:3px">µg/m³</span>
          </div>
          <div style="margin-top:6px;display:inline-block;padding:3px 10px;border-radius:20px;
            background:${color}18;color:${color};font-size:11px;font-weight:600;border:1px solid ${color}40">
            ${d.category}
          </div>
        </div>
      `, { className: 'light-popup' })
      m.on('click', () => onCityClick?.(d.city))
      layer.addLayer(m)
    })

    layer.addTo(mapInst.current)
    layerRef.current = layer
  }, [data, onCityClick, selectedCity])

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }} />
  )
}
