import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './App.css'
import Sidebar from './components/Sidebar/Sidebar'
import LandingPage from './pages/Landing/LandingPage'
import ConnectionsPage from './pages/Connections/ConnectionsPage'
import ConnectionWizard from './components/ConnectionWizard/ConnectionWizard'
import ChatPage from './pages/Chat/ChatPage'
import HistoryPage from './pages/History/HistoryPage'
import { listConnections } from './api/connections'
import type { Connection } from './types'

function AppShell() {
  const location = useLocation()
  const [connections, setConnections] = useState<Connection[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(true)

  const hideSidebar =
    location.pathname === '/' ||
    location.pathname === '/connections/new'

  useEffect(() => {
    listConnections().then(data => {
      setConnections(data)
      setLoadingConnections(false)
    }).catch(() => {
      setLoadingConnections(false)
    })
  }, [location.pathname])

  const handleConnectionsChange = (updated: Connection[]) => {
    setConnections(updated)
  }

  if (hideSidebar) {
    return (
      <div className="page-container">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/connections/new" element={<ConnectionWizard />} />
        </Routes>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar
        connections={connections}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(c => !c)}
        loading={loadingConnections}
      />
      <main className="app-main">
        <Routes>
          <Route path="/connections" element={<ConnectionsPage onConnectionsChange={handleConnectionsChange} />} />
          <Route path="/chat/:connectionId" element={<ChatPage />} />
          <Route path="/chat/:connectionId/:sessionId" element={<ChatPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/connections" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")

    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme)
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      document.documentElement.setAttribute(
        "data-theme",
        prefersDark ? "dark" : "light"
      )
    }
  }, [])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}
