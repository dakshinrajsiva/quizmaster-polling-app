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

  const handleJoinGame = () => {
    if (gameCode.trim()) {
      router.push(`/play/${gameCode.toUpperCase()}`)
    }
  }

  // Auto-connect to socket and listen for broadcast polls
  useEffect(() => {
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
  }, [router])

  const handleCreateGame = () => {
    router.push('/host')
  }

  const handleCreatePoll = () => {
    router.push('/poll')
  }

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
          {/* Main Actions */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Join Game Card */}
            <div className="card animate-slide-up">
              <div className="text-center mb-6">
                <div className="bg-primary-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Join Quiz</h2>
                <p className="text-gray-600">Enter a quiz code</p>
              </div>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Quiz Code"
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

            {/* Poll Status Card */}
            <div className="card animate-slide-up">
              <div className="text-center mb-6">
                <div className="bg-secondary-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-secondary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Live Polls</h2>
                <p className="text-gray-600">
                  {activePoll ? 'Poll is active!' : 'Waiting for polls...'}
                </p>
              </div>
              
              <div className="space-y-4">
                {activePoll ? (
                  <div className="bg-blue-100 border border-blue-400 text-blue-800 px-4 py-3 rounded mb-4">
                    <p className="font-bold text-lg mb-2">📊 Poll Available!</p>
                    <p className="text-base font-medium mb-2">{activePoll.question}</p>
                    <p className="text-sm text-blue-600">Click "Join Now" to participate in this poll</p>
                  </div>
                ) : (
                  <div className="bg-gray-100 border border-gray-300 text-gray-600 px-4 py-3 rounded mb-4">
                    <p className="text-sm">Waiting for polls to be launched...</p>
                  </div>
                )}
                
                <button
                  onClick={handleJoinPoll}
                  disabled={!activePoll}
                  className="btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <BarChart3 className="w-4 h-4 mr-2 inline" />
                  {activePoll ? 'Join Now' : 'No Active Poll'}
                </button>
              </div>
            </div>

            {/* Create Quiz Card */}
            <div className="card animate-slide-up">
              <div className="text-center mb-6">
                <div className="bg-warning-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-warning-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Create Quiz</h2>
                <p className="text-gray-600">Host competitive quizzes</p>
              </div>
              
              <button
                onClick={handleCreateGame}
                className="btn-warning w-full"
              >
                <Trophy className="w-4 h-4 mr-2 inline" />
                Create Quiz
              </button>
            </div>

            {/* Create Poll Card */}
            <div className="card animate-slide-up">
              <div className="text-center mb-6">
                <div className="bg-success-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-success-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Create Poll</h2>
                <p className="text-gray-600">Gather instant feedback</p>
              </div>
              
              <button
                onClick={handleCreatePoll}
                className="btn-success w-full"
              >
                <BarChart3 className="w-4 h-4 mr-2 inline" />
                Create Poll
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}