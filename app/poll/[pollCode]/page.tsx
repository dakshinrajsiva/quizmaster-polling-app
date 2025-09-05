'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Play, Square, Users, BarChart3, Clock, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import socketManager from '@/lib/socket-manager'
import { PollRoom, PollResult } from '@/types/quiz'
import { formatTime } from '@/lib/utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function PollHostPage() {
  const params = useParams()
  const router = useRouter()
  const pollCode = params.pollCode as string
  
  const [socket, setSocket] = useState<any>(null)
  const [room, setRoom] = useState<PollRoom | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [pollStatus, setPollStatus] = useState<'waiting' | 'active' | 'closed'>('waiting')
  const [results, setResults] = useState<PollResult | null>(null)
  const [showLiveResults, setShowLiveResults] = useState(true)

  useEffect(() => {
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)

    // Wait for connection before requesting poll state
    const requestPollState = () => {
      console.log('Requesting poll state for:', pollCode)
      socketInstance.emit('get-poll-state', { pollCode })
    }

    if (socketInstance.connected) {
      requestPollState()
    } else {
      socketInstance.on('connect', requestPollState)
    }

    socketInstance.on('poll-state', (data: any) => {
      console.log('Received poll state:', data)
      setRoom(data.room)
      setPollStatus(data.room.status)
      if (data.room.poll.timeLimit) {
        setTimeRemaining(data.room.poll.timeLimit)
      }
    })

    socketInstance.on('participant-joined', (data: any) => {
      setRoom(prev => prev ? { ...prev, participants: data.participants } : null)
    })

    socketInstance.on('participant-left', (data: any) => {
      setRoom(prev => prev ? { ...prev, participants: data.participants } : null)
    })

    socketInstance.on('poll-results-updated', (data: any) => {
      console.log('Poll results updated:', data)
      setResults(data)
    })

    socketInstance.on('poll-closed', (data: any) => {
      console.log('Poll closed:', data)
      setResults(data)
      setPollStatus('closed')
    })

    return () => {
      socketInstance.off('connect', requestPollState)
      socketInstance.off('poll-state')
      socketInstance.off('participant-joined')
      socketInstance.off('participant-left')
      socketInstance.off('poll-results-updated')
      socketInstance.off('poll-closed')
    }
  }, [pollCode])

  // Timer effect
  useEffect(() => {
    if (pollStatus === 'active' && room?.poll.timeLimit && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleClosePoll()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [pollStatus, room, timeRemaining])

  const startPoll = () => {
    console.log('Start poll clicked')
    console.log('Room:', room)
    console.log('Socket connected:', socket?.connected)
    
    if (!room || room.participants.length === 0) {
      console.log('Cannot start poll: no room or no participants')
      return
    }
    
    console.log('Emitting start-poll event for pollCode:', pollCode)
    socket?.emit('start-poll', { pollCode })
    setPollStatus('active')
    
    if (room.poll.timeLimit) {
      setTimeRemaining(room.poll.timeLimit)
    }
  }

  const handleClosePoll = () => {
    console.log('Closing poll')
    socket?.emit('close-poll', { pollCode })
  }

  const goBack = () => {
    router.push('/poll')
  }

  const getOptionPercentage = (optionIndex: number) => {
    if (!results || results.totalVotes === 0) return 0
    return Math.round((results.stats[optionIndex] / results.totalVotes) * 100)
  }

  const getMaxVotes = () => {
    if (!results) return 0
    return Math.max(...results.stats)
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading poll...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goBack}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Exit Poll
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">{room.poll.question}</h1>
            <p className="text-gray-600">Poll Code: <span className="font-mono font-bold">{pollCode}</span></p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-primary-600">
              <Users className="w-5 h-5 mr-2" />
              <span className="font-semibold">{room.participants.length}</span>
            </div>
            {room.poll.timeLimit && pollStatus === 'active' && (
              <div className="flex items-center text-warning-600">
                <Clock className="w-4 h-4 mr-1" />
                <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Poll Status */}
        {pollStatus === 'waiting' && (
          <div className="card text-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Ready to Start?</h2>
            <p className="text-gray-600 mb-6">
              {room.participants.length} participant{room.participants.length !== 1 ? 's' : ''} joined
            </p>
            <button
              onClick={startPoll}
              disabled={room.participants.length === 0}
              className="btn-success text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5 mr-2 inline" />
              Start Poll
            </button>
          </div>
        )}

        {/* Active Poll */}
        {pollStatus === 'active' && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Poll Active</h2>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowLiveResults(!showLiveResults)}
                  className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {showLiveResults ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                  {showLiveResults ? 'Hide' : 'Show'} Live Results
                </button>
                <button
                  onClick={handleClosePoll}
                  className="btn-danger"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Close Poll
                </button>
              </div>
            </div>
            
            {room.poll.timeLimit && (
              <div className="bg-gray-200 rounded-full h-2 mb-6">
                <div 
                  className="bg-primary-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(timeRemaining / room.poll.timeLimit) * 100}%` }}
                />
              </div>
            )}

            <div className="text-center mb-4">
              <p className="text-gray-600">
                {results?.votedCount || 0} of {room.participants.length} participants have voted
              </p>
            </div>
          </div>
        )}

        {/* Poll Results */}
        {(showLiveResults || pollStatus === 'closed') && results && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {pollStatus === 'closed' ? 'Final Results' : 'Live Results'}
              </h2>
              <div className="text-sm text-gray-600">
                {results.totalVotes} total votes
              </div>
            </div>

            <div className="space-y-4">
              {room.poll.options.map((option, index) => {
                const votes = results.stats[index]
                const percentage = getOptionPercentage(index)
                const isWinning = votes === getMaxVotes() && votes > 0
                
                return (
                  <div key={index} className="relative">
                    <div className={`p-4 rounded-lg border-2 transition-all ${
                      isWinning 
                        ? 'bg-green-100 border-green-300 text-green-800' 
                        : 'bg-gray-50 border-gray-200 text-gray-800'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-white bg-opacity-50 flex items-center justify-center font-bold mr-3">
                            {index + 1}
                          </div>
                          <span className="font-medium">{option}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">{votes}</div>
                          <div className="text-sm opacity-75">{percentage}%</div>
                        </div>
                      </div>
                      <div className="bg-white bg-opacity-50 rounded-full h-2">
                        <div
                          className="bg-white h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-800">{results.totalVotes}</div>
                <div className="text-sm text-gray-600">Total Votes</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-800">{results.participantCount}</div>
                <div className="text-sm text-gray-600">Participants</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-800">{results.votedCount}</div>
                <div className="text-sm text-gray-600">Voted</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-800">
                  {results.participantCount > 0 ? Math.round((results.votedCount / results.participantCount) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">Response Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Participants List */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Participants</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {room.participants.map((participant) => (
              <div
                key={participant.id}
                className={`flex items-center p-3 rounded-lg transition-all ${
                  participant.hasVoted 
                    ? 'bg-green-50 border-2 border-green-200' 
                    : 'bg-gray-50 border-2 border-gray-200'
                }`}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                  {participant.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-gray-800 flex-1">{participant.name}</span>
                {participant.hasVoted && (
                  <span className="text-green-600 text-sm font-medium">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
