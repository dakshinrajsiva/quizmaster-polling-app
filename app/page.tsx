'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Play, Users, Trophy, BarChart3 } from 'lucide-react'
import socketManager from '@/lib/socket-manager'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function HomePage() {
  const router = useRouter()
  const [gameCode, setGameCode] = useState('')
  const [socket, setSocket] = useState<any>(null)
  const [activePoll, setActivePoll] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)

  const handleJoinGame = () => {
    if (gameCode.trim()) {
      router.push(`/play/${gameCode.toUpperCase()}`)
    }
  }

  // Set client-side flag
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Auto-connect to socket and listen for broadcast polls
  useEffect(() => {
    if (!isClient) return

    console.log('🔌 PARTICIPANT: Connecting to socket...')
    // Force disconnect any existing connection to ensure fresh connection
    socketManager.disconnect()
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)
    
    socketInstance.on('connect', () => {
      console.log('✅ PARTICIPANT: Connected to server with ID:', socketInstance.id)
    })
    
    socketInstance.on('disconnect', () => {
      console.log('❌ PARTICIPANT: Disconnected from server')
    })

    // Listen for broadcast polls
    socketInstance.on('poll-broadcast', (data: any) => {
      console.log('🎯 PARTICIPANT: Poll broadcast received on HOME page:', data)
      console.log('🎯 PARTICIPANT: Poll question:', data.poll?.question)
      console.log('🎯 PARTICIPANT: Showing Join Now button...')
      setActivePoll(data.poll)
      // Don't auto-redirect - show Join Now button instead
    })

    // Listen for poll closed
    socketInstance.on('poll-broadcast-closed', () => {
      setActivePoll(null)
    })

    return () => {
      socketInstance.off('poll-broadcast')
      socketInstance.off('poll-broadcast-closed')
    }
  }, [router, isClient])


  const handleJoinPoll = () => {
    console.log('🎯 PARTICIPANT: Join Now clicked, redirecting to /vote...')
    // Store poll data in localStorage so vote page can access it
    if (activePoll) {
      localStorage.setItem('currentPoll', JSON.stringify(activePoll))
      console.log('💾 Stored poll data in localStorage:', activePoll.question)
    }
    router.push('/vote')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with logos */}
      <header className="w-full p-4 flex justify-between items-center">
        {/* HCL Logo - Top Left */}
        <div className="flex items-center">
          <Image
            src="/hcl.png"
            alt="HCL Logo"
            width={120}
            height={60}
            className="h-12 w-auto"
            priority
          />
        </div>
        
        {/* BM Logo - Top Right */}
        <div className="flex items-center">
          <Image
            src="/bm_logo_color.png"
            alt="BM Logo"
            width={120}
            height={60}
            className="h-12 w-auto"
            priority
          />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Public View - Active Polls Only */}
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Live Polls</h1>
              <p className="text-gray-600">Participate in real-time polls and surveys</p>
            </div>

            {/* Active Poll Display */}
            <div className="card animate-slide-up">
              <div className="text-center mb-6">
                <div className="bg-secondary-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <BarChart3 className="w-10 h-10 text-secondary-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {!isClient ? 'Loading...' : activePoll ? 'Poll Active!' : 'Waiting for Polls...'}
                </h2>
              </div>
              
              <div className="space-y-6">
                {!isClient ? (
                  // Server-side rendering placeholder
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <div className="text-gray-400 mb-4">
                      <BarChart3 className="w-16 h-16 mx-auto mb-2" />
                    </div>
                    <p className="text-gray-600 text-lg">Loading polls...</p>
                    <p className="text-gray-500 text-sm mt-2">Checking for active polls</p>
                  </div>
                ) : activePoll ? (
                  <div className="bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-300 rounded-lg p-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-800 mb-4">📊 {activePoll.question}</p>
                      <p className="text-blue-600 mb-6">A new poll is available! Click below to see the options and vote.</p>
                      <button
                        onClick={handleJoinPoll}
                        className="btn-primary text-xl px-8 py-3"
                      >
                        <BarChart3 className="w-5 h-5 mr-2 inline" />
                        Join Poll Now
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <div className="text-gray-400 mb-4">
                      <BarChart3 className="w-16 h-16 mx-auto mb-2" />
                    </div>
                    <p className="text-gray-600 text-lg">No active polls at the moment</p>
                    <p className="text-gray-500 text-sm mt-2">Polls will appear here when they're launched</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quiz Join Section */}
            <div className="card animate-slide-up mt-8">
              <div className="text-center mb-6">
                <div className="bg-primary-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Join Quiz</h2>
                <p className="text-gray-600">Have a quiz code? Enter it below</p>
              </div>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter Quiz Code"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  className="input-field text-center text-lg font-bold tracking-wider"
                  maxLength={6}
                />
                <button
                  onClick={handleJoinGame}
                  disabled={!gameCode.trim()}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <Play className="w-4 h-4 mr-2 inline" />
                  Join Quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}