'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const getSocket = (): Socket => {
  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
    console.log('Creating new socket connection to', socketUrl)
    socket = io(socketUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling']
    })
    
    socket.on('connect', () => {
      console.log('Socket.io client connected successfully to', socketUrl)
    })
    
    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error)
    })
  }
  return socket
}

export const connectSocket = (): Socket => {
  const socket = getSocket()
  if (!socket.connected) {
    socket.connect()
  }
  return socket
}

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const isSocketConnected = (): boolean => {
  return socket?.connected || false
}
