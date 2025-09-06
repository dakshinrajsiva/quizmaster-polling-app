'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Clock, Users, CheckCircle } from 'lucide-react'
import socketManager from '@/lib/socket-manager'
import { formatTime } from '@/lib/utils'

// Force dynamic rendering
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
      console.log('🌐 Socket URL:', (socketInstance as any).io.uri)
      
      // Auto-join poll in background if we have localStorage data
      if (storedPoll) {
        console.log('💾 Using poll data from localStorage, auto-joining poll...')
        setTimeout(() => {
          console.log('🤝 Auto-joining broadcast poll in background...')
          socketInstance.emit('join-broadcast-poll')
        }, 500) // Small delay to ensure everything is set up
      } else {
        console.log('🔍 No localStorage data, requesting current poll status...')
        socketInstance.emit('get-current-poll')
        console.log('📤 get-current-poll event emitted')
      }
    })

    // Handle poll broadcast - could be initial broadcast or join response
    socketInstance.on('poll-broadcast', (data: any) => {
      console.log('🎯 PARTICIPANT: Poll broadcast received on VOTE page:', data)
      console.log('🎯 PARTICIPANT: Poll question:', data.poll?.question)
      console.log('🎯 PARTICIPANT: Poll options:', data.poll?.options)
      
      setPoll(data.poll)
      setError('')
      
      // If we're already on the vote page, this is likely a join response
      // so we should show the poll as waiting for join confirmation
      console.log('🎯 PARTICIPANT: Setting poll status to waiting for join...')
      setPollStatus('waiting')
      
      // Set timer if applicable
      if (data.poll.timeLimit) {
        setTimeRemaining(data.poll.timeLimit)
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
      setError(data.message)
    })

    socketInstance.on('vote-submitted', (data: any) => {
      console.log('Vote submitted:', data)
      setResults(data.results)
      setPollStatus('voted')
    })

    socketInstance.on('vote-error', (data: any) => {
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
        setPollStatus('waiting')
        if (data.poll.timeLimit) {
          setTimeRemaining(data.poll.timeLimit)
        }
        // Auto-join the poll since user came from "Join Now" button
        console.log('👤 Auto-joining poll since user clicked Join Now...')
        setTimeout(() => {
          socketInstance.emit('join-broadcast-poll')
        }, 100) // Small delay to ensure poll is set
      } else {
        console.log('❌ No active poll found')
        setPollStatus('waiting')
      }
    })

    return () => {
      socketInstance.off('connect')
      socketInstance.off('poll-broadcast')
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

    socket?.emit('submit-broadcast-vote', {
      selectedOptions
    })
  }

  const joinPoll = () => {
    console.log('👤 PARTICIPANT: Joining broadcast poll...')
    socket?.emit('join-broadcast-poll')
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
              </div>
            )}

            <div className="space-y-3 mb-6">
              {poll.options.map((option: string, index: number) => (
                <button
                  key={index}
                  onClick={() => toggleOption(index)}
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    selectedOptions.includes(index)
                      ? 'border-secondary-500 bg-secondary-50'
                      : 'border-gray-200 hover:border-secondary-300'
                  }`}
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
              disabled={selectedOptions.length === 0}
              className="btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Vote
            </button>
          </div>
        </div>
      </div>
    )
  }

  // After voting - show results
  if (pollStatus === 'voted' || pollStatus === 'closed') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="card mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">{results?.question}</h1>
                <div className="flex items-center gap-4 text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{results?.participantCount} participants</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-4 h-4" />
                    <span>{results?.totalVotes} votes</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  pollStatus === 'voted' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {pollStatus === 'voted' ? 'Vote Submitted' : 'Poll Closed'}
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {results?.options.map((option: string, index: number) => {
                const votes = results.stats[index]
                const percentage = getOptionPercentage(index)
                const isMax = votes === getMaxVotes() && votes > 0

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{option}</span>
                      <span className="text-sm text-gray-600">
                        {votes} votes ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          isMax ? 'bg-secondary-600' : 'bg-secondary-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {pollStatus === 'voted' && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p className="font-medium">Thank you for voting!</p>
                <p className="text-sm">Results will update live as others vote.</p>
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

  // Fallback case - if we're active but missing poll data
  if (pollStatus === 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <div className="mb-6">
              <div className="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading Poll...</h1>
              <p className="text-gray-600">Getting poll data...</p>
              <p className="text-sm text-gray-500 mt-2">Status: {pollStatus}</p>
              <p className="text-sm text-gray-500">Poll: {poll ? 'Available' : 'Missing'}</p>
              <p className="text-sm text-gray-500">Question: {poll?.question || 'Missing'}</p>
              <p className="text-sm text-gray-500">Options: {poll?.options?.length || 0}</p>
            </div>

            <button
              onClick={goBack}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
