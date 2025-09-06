'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, Clock, CheckCircle, BarChart3, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import socketManager from '@/lib/socket-manager'
import { Participant, PollResult } from '@/types/quiz'
import { formatTime } from '@/lib/utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  const pollCode = params?.pollCode as string
  
  const [socket, setSocket] = useState<any>(null)
  const [pollStatus, setPollStatus] = useState<'joining' | 'waiting' | 'active' | 'voted' | 'closed'>('joining')
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [poll, setPoll] = useState<any>(null)
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [results, setResults] = useState<PollResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)

    socketInstance.on('poll-join-success', (data: any) => {
      console.log('Poll join success:', data)
      setParticipant(data.participant)
      setParticipants(data.room.participants)
      setPoll(data.room.poll)
      setPollStatus('waiting')
      setError('')
    })

    socketInstance.on('poll-join-error', (data: any) => {
      setError(data.message)
    })

    socketInstance.on('participant-joined', (data: any) => {
      setParticipants(data.participants)
    })

    socketInstance.on('participant-left', (data: any) => {
      setParticipants(data.participants)
    })

    socketInstance.on('poll-started', (data: any) => {
      console.log('Poll started:', data)
      setPollStatus('active')
      setPoll(data.poll)
      setSelectedOptions([])
      if (data.poll.timeLimit) {
        setTimeRemaining(data.poll.timeLimit)
      }
    })

    socketInstance.on('poll-results-updated', (data: any) => {
      setResults(data)
    })

    socketInstance.on('poll-closed', (data: any) => {
      console.log('Poll closed:', data)
      setResults(data)
      setPollStatus('closed')
    })

    socketInstance.on('poll-host-disconnected', () => {
      setError('Host has disconnected. Poll ended.')
      setTimeout(() => router.push('/'), 3000)
    })

    return () => {
      socketInstance.off('poll-join-success')
      socketInstance.off('poll-join-error')
      socketInstance.off('participant-joined')
      socketInstance.off('participant-left')
      socketInstance.off('poll-started')
      socketInstance.off('poll-results-updated')
      socketInstance.off('poll-closed')
      socketInstance.off('poll-host-disconnected')
    }
  }, [router])

  // Timer effect
  useEffect(() => {
    if (pollStatus === 'active' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1))
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [pollStatus, timeRemaining])

  const joinPoll = () => {
    socket?.emit('join-poll', {
      pollCode: pollCode.toUpperCase()
    })
  }

  const toggleOption = (optionIndex: number) => {
    if (pollStatus !== 'active' || !poll) return

    if (poll.allowMultipleChoices) {
      setSelectedOptions(prev => 
        prev.includes(optionIndex)
          ? prev.filter(i => i !== optionIndex)
          : [...prev, optionIndex]
      )
    } else {
      setSelectedOptions([optionIndex])
    }
  }

  const submitVote = () => {
    if (pollStatus !== 'active' || !participant || selectedOptions.length === 0) return
    
    console.log('Submitting vote:', selectedOptions)
    socket?.emit('submit-vote', {
      pollCode: pollCode.toUpperCase(),
      participantId: participant.id,
      selectedOptions
    })
    
    setPollStatus('voted')
  }

  const goBack = () => {
    router.push('/')
  }

  const getOptionPercentage = (optionIndex: number) => {
    if (!results || results.totalVotes === 0) return 0
    return Math.round((results.stats[optionIndex] / results.totalVotes) * 100)
  }

  const getMaxVotes = () => {
    if (!results) return 0
    return Math.max(...results.stats)
  }

  // Joining screen
  if (pollStatus === 'joining') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <div className="mb-6">
              <div className="bg-secondary-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-secondary-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Join Poll</h1>
              <p className="text-gray-600">Poll Code: <span className="font-mono font-bold">{pollCode}</span></p>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="text-center text-gray-600 mb-4">
                <p>Click below to join the poll anonymously</p>
                <p className="text-sm text-gray-500">You'll be identified by your session</p>
              </div>
              <button
                onClick={joinPoll}
                className="btn-primary w-full text-lg"
              >
                Join Poll
              </button>
              <button
                onClick={goBack}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Waiting for poll to start
  if (pollStatus === 'waiting') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Waiting for Poll to Start</h1>
            <p className="text-gray-600">Poll Code: <span className="font-mono font-bold text-lg">{pollCode}</span></p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">You're In!</h2>
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-secondary-500 to-primary-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
                  {participant?.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-lg font-semibold text-gray-800">{participant?.name}</h3>
              </div>
              <div className="text-center text-gray-600">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-secondary-500" />
                <p>Ready to vote!</p>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Participants</h2>
                <div className="flex items-center text-secondary-600">
                  <Users className="w-5 h-5 mr-2" />
                  <span className="font-semibold">{participants.length}</span>
                </div>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {participants.map((p) => (
                  <div key={p.id} className={`flex items-center p-3 rounded-lg ${
                    p.id === participant?.id ? 'bg-secondary-100 border-2 border-secondary-300' : 'bg-gray-50'
                  }`}>
                    <div className="w-10 h-10 bg-gradient-to-r from-secondary-500 to-primary-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">{p.name}</span>
                    {p.id === participant?.id && (
                      <span className="ml-auto text-secondary-600 text-sm font-medium">You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Active poll - voting
  if (pollStatus === 'active' && poll) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-between mb-4">
              <div></div>
              {poll.timeLimit && (
                <div className="flex items-center text-warning-600">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="font-mono font-bold text-lg">{formatTime(timeRemaining)}</span>
                </div>
              )}
            </div>
            
            {poll.timeLimit && (
              <div className="bg-gray-200 rounded-full h-2 mb-6">
                <div 
                  className="bg-warning-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(timeRemaining / poll.timeLimit) * 100}%` }}
                />
              </div>
            )}

            <h1 className="text-2xl font-bold text-gray-800">{poll.question}</h1>
            {poll.allowMultipleChoices && (
              <p className="text-gray-600 mt-2">You can select multiple options</p>
            )}
          </div>

          {/* Voting Options */}
          <div className="space-y-4 mb-8">
            {poll.options.map((option: string, index: number) => (
              <button
                key={index}
                onClick={() => toggleOption(index)}
                disabled={timeRemaining === 0}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  selectedOptions.includes(index)
                    ? 'bg-secondary-500 border-secondary-500 text-white ring-4 ring-secondary-300'
                    : 'bg-white border-gray-300 hover:border-secondary-500 text-gray-800'
                }`}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-white bg-opacity-30 flex items-center justify-center font-bold mr-3">
                    {index + 1}
                  </div>
                  <span className="font-medium text-left flex-1">{option}</span>
                  {selectedOptions.includes(index) && (
                    <CheckCircle className="w-6 h-6 ml-3" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              onClick={submitVote}
              disabled={selectedOptions.length === 0 || timeRemaining === 0}
              className="btn-success text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5 mr-2 inline" />
              Submit Vote
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Voted - waiting for results
  if (pollStatus === 'voted') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="card">
            <div className="mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Vote Submitted!</h2>
              <p className="text-gray-600">Waiting for other participants...</p>
            </div>
            
            {selectedOptions.length > 0 && poll && (
              <div className="max-w-md mx-auto">
                <p className="text-sm text-gray-600 mb-3">Your selection:</p>
                <div className="space-y-2">
                  {selectedOptions.map(optionIndex => (
                    <div key={optionIndex} className="p-3 bg-secondary-100 rounded-lg border-2 border-secondary-300">
                      <span className="font-medium text-secondary-800">{poll.options[optionIndex]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results && (
              <div className="mt-6 text-sm text-gray-600">
                {results.votedCount} of {results.participantCount} participants have voted
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Final results
  if (pollStatus === 'closed' && results && poll) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-secondary-400 to-secondary-600 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <BarChart3 className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Poll Results</h1>
            <h2 className="text-xl text-gray-600">{poll.question}</h2>
          </div>

          <div className="card mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Final Results</h3>
            
            <div className="space-y-4 mb-6">
              {poll.options.map((option: string, index: number) => {
                const votes = results.stats[index]
                const percentage = getOptionPercentage(index)
                const isWinning = votes === getMaxVotes() && votes > 0
                const wasSelected = selectedOptions.includes(index)
                
                return (
                  <div key={index} className="relative">
                    <div className={`p-4 rounded-lg border-2 transition-all ${
                      isWinning 
                        ? 'bg-green-100 border-green-300 text-green-800' 
                        : wasSelected
                        ? 'bg-secondary-100 border-secondary-300 text-secondary-800'
                        : 'bg-gray-50 border-gray-200 text-gray-800'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-white bg-opacity-50 flex items-center justify-center font-bold mr-3">
                            {index + 1}
                          </div>
                          <span className="font-medium">{option}</span>
                          {wasSelected && (
                            <span className="ml-2 text-secondary-600 text-sm">(Your vote)</span>
                          )}
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
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

          <div className="text-center">
            <button onClick={goBack} className="btn-primary text-lg">
              Create New Poll
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-secondary-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
