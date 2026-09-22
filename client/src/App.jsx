import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import PublicLayout from './components/layout/PublicLayout.jsx'
import { getStoredUser } from './lib/api.js'
import DailyPlan from './pages/DailyPlan.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Insights from './pages/Insights.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Tasks from './pages/Tasks.jsx'

function RequireAuth({ children }) {
  const user = getStoredUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/plan" element={<DailyPlan />} />
          <Route path="/insights" element={<Insights />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
