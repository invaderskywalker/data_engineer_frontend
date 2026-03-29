import { useState, useEffect, useCallback } from 'react'
import type { Connection } from '../types'
import { listConnections, deleteConnection as apiDeleteConnection } from '../api/connections'

interface UseConnectionsResult {
  connections: Connection[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  deleteConnection: (id: string) => Promise<void>
}

export function useConnections(): UseConnectionsResult {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listConnections()
      setConnections(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const deleteConnection = useCallback(async (id: string) => {
    await apiDeleteConnection(id)
    setConnections(prev => prev.filter(c => c.id !== id))
  }, [])

  return {
    connections,
    loading,
    error,
    refetch: fetchConnections,
    deleteConnection,
  }
}
