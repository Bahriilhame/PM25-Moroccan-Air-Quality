import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Wind, Map, Trophy, Settings } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Ranking   from './pages/Ranking'
import Admin     from './pages/Admin'

const NAV = [
  { to: '/',        icon: Map,      label: 'Carte'      },
  { to: '/ranking', icon: Trophy,   label: 'Classement' },
  { to: '/admin',   icon: Settings, label: 'Admin'      },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-dark overflow-hidden">

        {/* Barre de navigation verticale */}
        <nav className="w-14 shrink-0 border-r border-border bg-card flex flex-col items-center py-4 gap-1">
          <div className="mb-5 p-2">
            <Wind size={18} className="text-blue-400" />
          </div>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              className={({ isActive }) =>
                `w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150
                 ${isActive
                   ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10'
                   : 'text-gray-600 hover:text-white hover:bg-white/5'}`
              }
            >
              <Icon size={17} />
            </NavLink>
          ))}
        </nav>

        {/* Contenu principal */}
        <div className="flex-1 overflow-auto min-w-0">
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/ranking" element={<Ranking />}   />
            <Route path="/admin"   element={<Admin />}     />
          </Routes>
        </div>

      </div>
    </BrowserRouter>
  )
}
