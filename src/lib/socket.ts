import { io, type Socket } from 'socket.io-client'

// Same host as the API server, no /de prefix
const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'http://localhost:7001'

let _socket: Socket | null = null
let _permanentlyFailed = false

/** Callbacks registered by consumers to be notified when the socket instance changes. */
const _onSocketReplaced: Array<(s: Socket) => void> = []

/** Subscribe to socket replacement events (e.g. after reconnect_failed + forceReconnect). */
export function onSocketReplaced(cb: (s: Socket) => void): () => void {
  _onSocketReplaced.push(cb)
  return () => {
    const i = _onSocketReplaced.indexOf(cb)
    if (i !== -1) _onSocketReplaced.splice(i, 1)
  }
}

/**
 * Returns the singleton socket.io client, creating it on first call.
 * Passes the JWT from localStorage as the auth token on connect.
 */
export function getSocket(): Socket {
  if (_socket) return _socket

  // const token = localStorage.getItem('auth_token') ?? ''

  _socket = io(WS_URL, {
    auth: { user_id: 1},
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 20000,
  })

  _socket.on('connect', () => {
    console.debug('[socket] connected', _socket?.id)
  })

  _socket.on('disconnect', reason => {
    console.debug('[socket] disconnected', reason)
  })

  _socket.on('connect_error', err => {
    console.error('[socket] connect_error:', err.message)
  })

  // After exhausting all reconnection attempts the socket gives up permanently.
  // Mark it so callers know a forceReconnect() is needed.
  _socket.io.on('reconnect_failed', () => {
    console.error('[socket] reconnect_failed — all attempts exhausted')
    _permanentlyFailed = true
  })

  _socket.io.on('reconnect', (attempt: number) => {
    console.debug(`[socket] reconnected after ${attempt} attempt(s)`)
  })

  return _socket
}

/** True after reconnect_failed — the socket will not recover on its own. */
export function isSocketFailed(): boolean {
  return _permanentlyFailed
}

/**
 * Disconnect and clear the singleton (e.g. on logout).
 */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
  _permanentlyFailed = false
}

/**
 * Re-connect after a token change (e.g. after login), or after reconnect_failed.
 * Destroys the old socket so the next getSocket() uses the new token.
 * Notifies any registered consumers so they can re-attach their listeners.
 */
export function forceReconnect(): Socket {
  disconnectSocket()
  const s = getSocket()
  _onSocketReplaced.forEach(cb => cb(s))
  return s
}

/**
 * @deprecated Use forceReconnect() instead — it notifies all consumers.
 */
export function reconnectSocket(): void {
  forceReconnect()
}
