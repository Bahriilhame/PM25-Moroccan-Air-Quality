import { useState } from 'react'
import { Settings, Database, Play, RefreshCw, Cpu, Upload } from 'lucide-react'
import { adminCollect, adminPredict, adminFineTune, adminFullRetrain, adminPush } from '../utils/api'
import { useHealth } from '../hooks/usePredictions'

function JobBtn({ icon: Icon, label, desc, onClick, color }) {
  const [st, setSt] = useState(null)
  const colors = {
    blue:   'border-blue-500/30   hover:bg-blue-500/10   text-blue-400',
    green:  'border-green-500/30  hover:bg-green-500/10  text-green-400',
    yellow: 'border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-400',
    red:    'border-red-500/30    hover:bg-red-500/10    text-red-400',
    gray:   'border-gray-500/30   hover:bg-gray-500/10   text-gray-400',
  }
  const run = async () => {
    setSt('loading')
    try { await onClick(); setSt('ok') }
    catch { setSt('error') }
    setTimeout(() => setSt(null), 4000)
  }
  return (
    <button
      onClick={run}
      disabled={st === 'loading'}
      className={`w-full flex items-start gap-4 p-4 rounded-xl border bg-card transition-all text-left
        ${colors[color]} ${st === 'loading' ? 'opacity-60 cursor-wait' : ''}`}
    >
      <div className="mt-0.5 shrink-0">
        {st === 'loading' ? <RefreshCw size={16} className="animate-spin" /> : <Icon size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm">{label}</div>
        <div className="text-gray-500 text-xs mt-0.5 leading-relaxed">{desc}</div>
      </div>
      {st === 'ok'    && <span className="text-green-400 text-xs shrink-0 mt-0.5">✓ Lancé</span>}
      {st === 'error' && <span className="text-red-400   text-xs shrink-0 mt-0.5">✗ Erreur</span>}
    </button>
  )
}

export default function Admin() {
  const health = useHealth()

  return (
    <div className="min-h-screen bg-dark p-6">
      <div className="max-w-xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <Settings size={20} className="text-gray-400" />
          <h1 className="text-xl font-bold text-white">Admin MLOps</h1>
        </div>

        {/* Status système */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Statut système</h2>
          {health ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                ['API',            health.status === 'ok' ? '✅ OK' : '❌ KO'],
                ['Modèle',         health.model_loaded ? '✅ Chargé' : '❌ Absent'],
                ['Prédictions',    health.predictions_available ? '✅ Dispo' : '⏳ En attente'],
                ['Nb prédictions', `${health.n_predictions || 0}`],
              ].map(([k, v]) => (
                <div key={k} className="bg-dark/60 rounded-lg px-3 py-2 flex justify-between text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-600 text-sm text-center py-2">Connexion...</div>
          )}
        </div>

        {/* Jobs */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Jobs manuels</h2>
          <div className="space-y-2">
            <JobBtn icon={Database} label="Collecte OWM"         color="blue"
              desc="Collecte PM2.5 + météo pour les 53 villes depuis OpenWeatherMap"
              onClick={adminCollect} />
            <JobBtn icon={Play}     label="Générer prédictions"  color="green"
              desc="Blend Enrichi V2 → H+1 à H+24 pour toutes les villes"
              onClick={adminPredict} />
            <JobBtn icon={Upload}   label="Push vers HF Dataset" color="gray"
              desc="Envoie history.csv + prédictions vers bahriilhame/pm25-moroccan-data"
              onClick={adminPush} />
            <JobBtn icon={RefreshCw} label="Fine-tune (30j)"     color="yellow"
              desc="Réentraînement rapide LGB + CatBoost sur les 30 derniers jours"
              onClick={adminFineTune} />
            <JobBtn icon={Cpu}      label="Full retrain"          color="red"
              desc="Réentraînement complet depuis zéro sur tout l'historique (20–60 min)"
              onClick={adminFullRetrain} />
          </div>
        </div>

        {/* Planning */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Planning automatique (UTC)</h2>
          <div className="space-y-1.5 text-sm">
            {[
              ['H:00',         'Collecte OWM — 53 villes'],
              ['H:05',         'Prédictions Blend Enrichi V2'],
              ['H:06',         'Push history.csv + prédictions → HF Dataset'],
              ['03:30 / jour', 'Fine-tune (30 derniers jours)'],
              ['Dim 02:00',    'Full retrain hebdomadaire'],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3 bg-dark/50 rounded-lg px-3 py-2">
                <span className="text-blue-400 font-mono text-xs w-28 shrink-0 mt-0.5">{t}</span>
                <span className="text-gray-400 text-xs">{d}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
