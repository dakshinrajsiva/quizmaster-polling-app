'use client'

import { io, Socket } from 'socket.io-client'

class SocketManager {
  private socket: Socket | null = null
  private gameCode: string | null = null

  connect(): Socket {
    if (!this.socket) {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://quizmaster-app-production.up.railway.app'
      const socketPath = '/socket.io/'
      console.log('Creating new socket connection to', socketUrl, 'with path', socketPath)
      
      this.socket = io(socketUrl, {
        path: socketPath,
        autoConnect: true,
        // Enable both transports with polling fallback
        transports: ['websocket', 'polling'],
        // Production optimizations
        upgrade: true,
        // Timeout configurations
        timeout: 20000,
        // Reconnection settings for production
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        // Force long polling in unreliable networks
        forceNew: true
      })

      this.socket.on('connect', () => {
        console.log('Socket.io client connected successfully to', socketUrl)
        console.log('Transport:', this.socket?.io.engine.transport.name)
        
        // Log transport upgrades
        this.socket?.io.engine.on('upgrade', (transport) => {
          console.log('Transport upgraded to:', transport.name)
        })
      })

      this.socket.on('connect_error', (error) => {
        console.error('Socket.io connection error:', error)
        // Fallback to long polling if WebSocket fails
        console.log('Falling back to long polling...')
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
        if (reason === 'io server disconnect') {
          // Server disconnected the client, reconnect manually
          this.socket?.connect()
        }
      })

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts')
      })

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Reconnection attempt', attemptNumber)
      })

      this.socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error)
      })

      this.socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect after maximum attempts')
      })

      // Handle production-specific events
      this.socket.on('rate-limit-exceeded', (data) => {
        console.warn('Rate limit exceeded:', data.message)
        // Show user-friendly message
        alert('Please slow down your actions. Too many requests.')
      })

      this.socket.on('connection-rejected', (data) => {
        console.error('Connection rejected:', data.message)
        alert(data.message)
      })
    }

    return this.socket
  }

  getSocket(): Socket | null {
    return this.socket
  }

  setGameCode(code: string) {
    this.gameCode = code
  }

  getGameCode(): string | null {
    return this.gameCode
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  disconnect() {
    if (this.socket) {
      console.log('Manually disconnecting socket')
      this.socket.disconnect()
      this.socket = null
      this.gameCode = null
    }
  }
}

// Global singleton instance
const socketManager = new SocketManager()

export default socketManager
