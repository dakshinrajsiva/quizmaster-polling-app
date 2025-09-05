'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Users, Trophy, Zap, BarChart3 } from 'lucide-react'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function HomePage() {
  const router = useRouter()
  const [gameCode, setGameCode] = useState('')
  const [pollCode, setPollCode] = useState('')

  const handleJoinGame = () => {
    if (gameCode.trim()) {
      router.push(`/play/${gameCode.toUpperCase()}`)
    }
  }

  const handleJoinPoll = () => {
    if (pollCode.trim()) {
      router.push(`/vote/${pollCode.toUpperCase()}`)
    }
  }

  const handleCreateGame = () => {
    router.push('/host')
  }

  const handleCreatePoll = () => {
    router.push('/poll')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12 animate-bounce-in">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-4 rounded-full">
              <Zap className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-4">
            QuizMaster
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Create engaging interactive quizzes and real-time polls. Compete with friends and gather instant feedback!
          </p>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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

          {/* Join Poll Card */}
          <div className="card animate-slide-up">
            <div className="text-center mb-6">
              <div className="bg-secondary-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-secondary-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Join Poll</h2>
              <p className="text-gray-600">Enter a poll code</p>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Poll Code"
                value={pollCode}
                onChange={(e) => setPollCode(e.target.value.toUpperCase())}
                className="input-field text-center text-lg font-bold tracking-wider"
                maxLength={6}
              />
              <button
                onClick={handleJoinPoll}
                disabled={!pollCode.trim()}
                className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <BarChart3 className="w-4 h-4 mr-2 inline" />
                Join Poll
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

        {/* Features */}
        <div className="grid md:grid-cols-4 gap-4 animate-slide-up">
          <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm">
            <div className="bg-success-100 p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <Zap className="w-6 h-6 text-success-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Real-time</h3>
            <p className="text-xs text-gray-600">Instant updates and live results</p>
          </div>
          
          <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm">
            <div className="bg-warning-100 p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <Users className="w-6 h-6 text-warning-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Multiplayer</h3>
            <p className="text-xs text-gray-600">Unlimited participants</p>
          </div>
          
          <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm">
            <div className="bg-primary-100 p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Competitive</h3>
            <p className="text-xs text-gray-600">Scoring and leaderboards</p>
          </div>

          <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm">
            <div className="bg-secondary-100 p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-secondary-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Analytics</h3>
            <p className="text-xs text-gray-600">Live poll results and insights</p>
          </div>
        </div>
      </div>
    </div>
  )
}
