'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Clock, Users, CheckCircle } from 'lucide-react'
import socketManager from '@/lib/socket-manager'
import { formatTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default function BroadcastVotePage() {
  const router = useRouter()
  const [socket, setSocket] = useState<any>(null)
  const [pollStatus, setPollStatus] = useState<'waiting' | 'active' | 'voted' | 'closed'>('waiting')
  const [participant, setParticipant] = useState<any>(null)
  const [poll, setPoll] = useState<any>(null)
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState('')
  const [participantCount, setParticipantCount] = useState(0)

  useEffect(() => {
    console.log('🔌 PARTICIPANT: Connecting to socket from /vote page...')
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)

    // Check localStorage first for poll data
    const storedPoll = localStorage.getItem('currentPoll')
    if (storedPoll) {
      try {
        const pollData = JSON.parse(storedPoll)
        console.log('💾 Found poll data in localStorage:', pollData.question)
        console.log('🎯 Immediately showing voting interface (no waiting screen)')
        setPoll(pollData)
        setPollStatus('active') // Skip waiting, go straight to voting interface
        localStorage.removeItem('currentPoll') // Clean up
      } catch (error) {
        console.error('❌ Error parsing stored poll data:', error)
      }
    }

    socketInstance.on('connect', () => {
      console.log('✅ PARTICIPANT: Connected to server from /vote page with ID:', socketInstance.id)
      console.log('🔌 Socket connected status:', socketInstance.connected)
      
      // Always auto-join poll when connected - with longer delay
      console.log('🤝 Auto-joining broadcast poll on connect...')
      setTimeout(() => {
        console.log('📤 Emitting join-broadcast-poll event...')
        socketInstance.emit('join-broadcast-poll')
      }, 1000) // Increased delay to ensure server is ready
      
      // Also request current poll status if no localStorage data
      if (!storedPoll) {
        console.log('🔍 No localStorage data, requesting current poll status...')
        setTimeout(() => {
          socketInstance.emit('get-current-poll')
          console.log('📤 get-current-poll event emitted')
        }, 500)
      }
    })

    socketInstance.on('poll-join-success', (data: any) => {
      console.log('✅ Successfully joined broadcast poll:', data)
      console.log('👤 Participant:', data.participant?.name)
      console.log('📊 Participant count:', data.participantCount)
      
      // Update participant info (poll data already set from localStorage)
      setParticipant(data.participant)
      setParticipantCount(data.participantCount)
      
      // Ensure status is active (should already be from localStorage)
      if (pollStatus !== 'active') {
        setPollStatus('active')
        console.log('✅ Status updated to active')
      }
    })

    socketInstance.on('poll-join-error', (data: any) => {
      console.log('❌ Failed to join poll:', data.message)
      setError(data.message)
    })

    socketInstance.on('vote-submitted', (data: any) => {
      console.log('✅ Vote submitted successfully:', data)
      setResults(data.results)
      setPollStatus('voted')
    })

    socketInstance.on('vote-error', (data: any) => {
      console.log('❌ Vote submission failed:', data.message)
      setError(data.message)
    })

    socketInstance.on('poll-results-updated', (data: any) => {
      setResults(data)
      setParticipantCount(data.participantCount)
    })

    socketInstance.on('poll-broadcast-closed', (data: any) => {
      console.log('Poll closed:', data)
      setResults(data)
      setPollStatus('closed')
    })

    // Handle current poll response
    socketInstance.on('current-poll-response', (data: any) => {
      console.log('📋 Current poll response:', data)
      if (data.poll && data.poll.status === 'active') {
        console.log('🎯 Found active poll:', data.poll.question)
        setPoll(data.poll)
        setPollStatus('active') // Show voting interface immediately
        if (data.poll.timeLimit) {
          setTimeRemaining(data.poll.timeLimit)
        }
        // Auto-join the poll
        console.log('👤 Auto-joining poll from current-poll-response...')
        setTimeout(() => {
          socketInstance.emit('join-broadcast-poll')
        }, 200)
      } else {
        console.log('❌ No active poll found')
        setPollStatus('waiting')
      }
    })

    return () => {
      socketInstance.off('connect')
      socketInstance.off('poll-join-success')
      socketInstance.off('poll-join-error')
      socketInstance.off('vote-submitted')
      socketInstance.off('vote-error')
      socketInstance.off('poll-results-updated')
      socketInstance.off('poll-broadcast-closed')
      socketInstance.off('current-poll-response')
    }
  }, [])

  // Timer effect
  useEffect(() => {
    if (pollStatus === 'active' && poll?.timeLimit && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1))
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [pollStatus, poll, timeRemaining])

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
    if (selectedOptions.length === 0) {
      setError('Please select at least one option')
      return
    }

    console.log('🗳️ PARTICIPANT: Submitting vote with options:', selectedOptions)
    console.log('🗳️ PARTICIPANT: Socket connected:', socket?.connected)
    console.log('🗳️ PARTICIPANT: Socket ID:', socket?.id)
    console.log('🗳️ PARTICIPANT: Participant joined:', !!participant)

    socket?.emit('submit-broadcast-vote', {
      selectedOptions
    })
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

  // If no poll data available, show simple waiting message
  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <div className="mb-6">
              <div className="bg-secondary-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-secondary-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">No Active Poll</h1>
              <p className="text-gray-600">Go back to home and wait for a poll to be launched.</p>
            </div>

            <button
              onClick={goBack}
              className="btn-secondary w-full"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show voting interface if we have poll data (regardless of status)
  if (poll && poll.question && poll.options) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="card mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">{poll.question}</h1>
                <div className="flex items-center gap-4 text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{participantCount} participants</span>
                  </div>
                  {poll.timeLimit && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime(timeRemaining)}</span>
                    </div>
                  )}
                  {participant && (
                    <div className="text-sm text-green-600">
                      ✅ Joined as {participant.name}
                    </div>
                  )}
                  {!participant && (
                    <div className="text-sm text-yellow-600">
                      ⏳ Joining poll...
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={goBack}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Back
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
                <button 
                  onClick={() => setError('')} 
                  className="ml-2 text-red-900 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="space-y-3 mb-6">
              {poll.options.map((option: string, index: number) => (
                <button
                  key={index}
                  onClick={() => toggleOption(index)}
                  disabled={!participant} // Disable until joined
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    selectedOptions.includes(index)
                      ? 'border-secondary-500 bg-secondary-50'
                      : 'border-gray-200 hover:border-secondary-300'
                  } ${!participant ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option}</span>
                    {selectedOptions.includes(index) && (
                      <CheckCircle className="w-5 h-5 text-secondary-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {poll.allowMultipleChoices && (
              <p className="text-sm text-gray-600 mb-4">
                You can select multiple options
              </p>
            )}

            <button
              onClick={submitVote}
              disabled={selectedOptions.length === 0 || !participant} // Disable until joined
              className="btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!participant ? 'Joining Poll...' : 'Submit Vote'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Fallback for other poll statuses
  if (pollStatus === 'voted') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="card">
            <div className="text-center mb-6">
              <div className="bg-green-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Vote Submitted!</h1>
              <p className="text-gray-600">Thank you for participating</p>
            </div>

            {results && (
              <div className="space-y-4 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Live Results</h2>
                {results.options.map((option: string, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{option}</span>
                      <span className="text-gray-600">
                        {results.stats[index]} votes ({getOptionPercentage(index)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-secondary-500 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${getOptionPercentage(index)}%`,
                          opacity: results.stats[index] === getMaxVotes() && getMaxVotes() > 0 ? 1 : 0.7
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="text-center text-gray-600 mt-4">
                  Total votes: {results.totalVotes} | Participants: {results.participantCount}
                </div>
              </div>
            )}

            <button
              onClick={goBack}
              className="btn-secondary w-full"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (pollStatus === 'closed') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="card">
            <div className="text-center mb-6">
              <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-gray-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Poll Closed</h1>
              <p className="text-gray-600">This poll has ended</p>
            </div>

            {results && (
              <div className="space-y-4 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Final Results</h2>
                {results.options.map((option: string, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{option}</span>
                      <span className="text-gray-600">
                        {results.stats[index]} votes ({getOptionPercentage(index)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-secondary-500 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${getOptionPercentage(index)}%`,
                          opacity: results.stats[index] === getMaxVotes() && getMaxVotes() > 0 ? 1 : 0.7
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="text-center text-gray-600 mt-4">
                  Total votes: {results.totalVotes} | Participants: {results.participantCount}
                </div>
              </div>
            )}

            <button
              onClick={goBack}
              className="btn-secondary w-full"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
