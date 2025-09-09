'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Users, Clock, ArrowLeft, BarChart3, Eye, EyeOff } from 'lucide-react'
import { Poll } from '@/types/quiz'
import socketManager from '@/lib/socket-manager'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { v4 as uuidv4 } from 'uuid'

export default function PollPage() {
  const router = useRouter()
  const [currentView, setCurrentView] = useState<'create' | 'ready' | 'results'>('create')
  const [poll, setPoll] = useState<Poll>({
    id: '',
    question: '',
    options: ['', ''],
    allowMultipleChoices: false,
    isAnonymous: true,
    timeLimit: 300, // Default to 5 minutes instead of undefined
    createdAt: new Date(),
    createdBy: ''
  })
  const [pollReady, setPollReady] = useState(false)
  const [pollActive, setPollActive] = useState(false)
  const [pollClosed, setPollClosed] = useState(false)
  const [pollResults, setPollResults] = useState<any>(null)
  const [socket, setSocket] = useState<any>(null)

  useEffect(() => {
    console.log('🎤 PRESENTER: Connecting to socket...')
    // Force disconnect any existing connection to ensure fresh connection
    socketManager.disconnect()
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)

    socketInstance.on('broadcast-poll-created', (data: any) => {
      console.log('Broadcast poll created:', data)
      setPollReady(true)
      setCurrentView('ready')
    })

    socketInstance.on('poll-results-updated', (data: any) => {
      console.log('📊 Poll results updated:', data)
      setPollResults(data)
    })

    socketInstance.on('poll-final-results', (data: any) => {
      console.log('🏆 Final results received for presenter:', data)
      setPollResults(data)
      setPollActive(false)
      setPollClosed(true)
      // Don't automatically switch to results view - let admin choose
    })

    socketInstance.on('poll-broadcast-closed', (data: any) => {
      console.log('🏁 Poll closed with final results:', data)
      // This is for participants, presenter gets poll-final-results
    })

    return () => {
      socketInstance.off('broadcast-poll-created')
      socketInstance.off('poll-results-updated')
      socketInstance.off('poll-final-results')
      socketInstance.off('poll-broadcast-closed')
    }
  }, [])

  const addOption = () => {
    if (poll.options.length < 10) {
      setPoll(prev => ({
        ...prev,
        options: [...prev.options, '']
      }))
    }
  }

  const updateOption = (index: number, value: string) => {
    setPoll(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }))
  }

  const removeOption = (index: number) => {
    if (poll.options.length > 2) {
      setPoll(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }))
    }
  }

  const createPoll = () => {
    console.log('Create broadcast poll clicked')
    console.log('Poll state:', poll)
    
    if (!poll.question.trim()) {
      alert('Please enter a poll question')
      return
    }

    const validOptions = poll.options.filter(opt => opt.trim())
    if (validOptions.length < 2) {
      alert('Please provide at least 2 options')
      return
    }

    console.log('Emitting create-broadcast-poll event')
    socket?.emit('create-broadcast-poll', {
      poll: {
        ...poll,
        id: uuidv4(),
        options: validOptions,
        createdAt: new Date()
      },
      hostName: 'Poll Host'
    })
  }

  const launchPoll = () => {
    console.log('🚀 PRESENTER: Launch poll clicked')
    console.log('🔌 PRESENTER: Socket connected:', socket?.connected)
    console.log('🎯 PRESENTER: Current poll question:', poll.question)
    console.log('📡 PRESENTER: Emitting launch-broadcast-poll event...')
    socket?.emit('launch-broadcast-poll')
    setPollActive(true)
    console.log('✅ PRESENTER: Poll launched! Waiting for participants...')
  }

  const closePoll = () => {
    console.log('🛑 Close poll clicked')
    socket?.emit('close-broadcast-poll')
    setPollActive(false)
    // Don't reset immediately - wait for final results
  }

  const showResults = () => {
    setCurrentView('results')
  }

  const resetPoll = () => {
    setPollReady(false)
    setPollActive(false)
    setPollClosed(false)
    setCurrentView('create')
    // Reset poll
    setPoll({
      id: '',
      question: '',
      options: ['', ''],
      allowMultipleChoices: false,
      isAnonymous: true,
      timeLimit: 300, // Default to 5 minutes
      createdAt: new Date(),
      createdBy: ''
    })
    setPollResults(null)
  }

  const goBack = () => {
    if (currentView === 'ready' || currentView === 'results') {
      resetPoll()
    } else {
      router.push('/')
    }
  }

  const addSamplePoll = () => {
    setPoll({
      id: uuidv4(),
      question: 'What is your favorite programming language?',
      options: ['JavaScript', 'Python', 'TypeScript', 'Go'],
      allowMultipleChoices: false,
      isAnonymous: true,
      timeLimit: 300, // 5 minutes for demo
      createdAt: new Date(),
      createdBy: 'Poll Host'
    })
  }

  // Final Results View - Clean Professional Display
  if (currentView === 'results') {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6 overflow-hidden">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-3">Poll Results</h1>
            <p className="text-xl text-gray-600 font-medium">{poll.question}</p>
            <div className="flex justify-center items-center gap-8 mt-4">
              <div className="text-center">
                <span className="text-3xl font-bold text-blue-600">{pollResults?.participantCount || 0}</span>
                <p className="text-sm text-gray-500">Participants</p>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold text-green-600">{pollResults?.totalVotes || 0}</span>
                <p className="text-sm text-gray-500">Total Votes</p>
              </div>
            </div>
          </div>

          {/* Results Display */}
          <div className="flex-1 bg-white rounded-2xl shadow-lg p-8 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="grid gap-6 flex-1">
                {pollResults?.options.map((option: string, index: number) => {
                  const votes = pollResults.stats[index] || 0
                  const percentage = pollResults.totalVotes > 0 
                    ? Math.round((votes / pollResults.totalVotes) * 100) 
                    : 0
                  const isWinner = votes === Math.max(...pollResults.stats) && votes > 0
                  
                  return (
                    <div key={index} className="relative">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          {isWinner && votes > 0 && (
                            <span className="text-2xl">🏆</span>
                          )}
                          <span className={`text-2xl font-bold ${
                            isWinner ? 'text-yellow-600' : 'text-gray-800'
                          }`}>
                            {option}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-bold text-gray-800">
                            {votes}
                          </span>
                          <span className="text-lg text-gray-500 ml-2">
                            ({percentage}%)
                          </span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-8 shadow-inner">
                        <div
                          className={`h-8 rounded-full transition-all duration-2000 ease-out ${
                            isWinner 
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' 
                              : 'bg-gradient-to-r from-blue-400 to-blue-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        >
                          <div className="flex items-center justify-center h-full">
                            {percentage > 15 && (
                              <span className="text-white font-bold text-lg">{percentage}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={resetPoll}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Create New Poll
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (currentView === 'ready') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={goBack}
              className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Editor
            </button>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{poll.question}</h1>
              <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
                <span className="flex items-center">
                  <BarChart3 className="w-4 h-4 mr-1" />
                  {poll.options.length} options
                </span>
                <span className="flex items-center">
                  {poll.isAnonymous ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {poll.isAnonymous ? 'Anonymous' : 'Public'}
                </span>
                {poll.timeLimit && (
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {poll.timeLimit}s limit
                  </span>
                )}
              </div>
            </div>
            <div></div>
          </div>

          {/* Poll Ready Display */}
          <div className="card text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📡 Broadcast Poll Ready</h2>
            <div className="flex gap-4 justify-center">
              {!pollActive && !pollClosed ? (
                <button
                  onClick={launchPoll}
                  className="btn-success text-lg px-8 py-3"
                >
                  🚀 Launch Poll to Everyone
                </button>
              ) : pollActive ? (
                <button
                  onClick={closePoll}
                  className="btn-danger text-lg px-8 py-3"
                >
                  🛑 Close Poll
                </button>
              ) : pollClosed ? (
                <div className="space-y-4">
                  <div className="bg-green-100 border border-green-300 text-green-800 px-6 py-3 rounded-lg">
                    <p className="font-semibold">✅ Poll Successfully Closed!</p>
                    <p className="text-sm mt-1">
                      {pollResults?.participantCount || 0} participants • {pollResults?.totalVotes || 0} total votes
                    </p>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={showResults}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold text-lg px-8 py-3 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105"
                    >
                      📊 Show Results
                    </button>
                    <button
                      onClick={resetPoll}
                      className="btn-secondary text-lg px-8 py-3"
                    >
                      🆕 Create New Poll
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Poll Status and Results */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="card">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Poll Status
              </h3>
              
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border-2 ${
                  pollActive 
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : pollClosed
                    ? 'bg-gray-50 border-gray-200 text-gray-800'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {pollActive ? '🟢 Poll is LIVE' : pollClosed ? '⚫ Poll Closed' : '🟡 Poll Ready to Launch'}
                    </span>
                    {pollResults && (
                      <span className="text-sm">
                        {pollResults.participantCount} participants, {pollResults.totalVotes} votes
                      </span>
                    )}
                  </div>
                </div>
                
                {pollActive && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg">
                    <p className="text-sm">
                      📱 Poll is now visible on everyone's screens!<br />
                      Results will update here in real-time.
                    </p>
                  </div>
                )}
                
                {pollClosed && (
                  <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg">
                    <p className="text-sm">
                      🏁 Poll has been closed successfully!<br />
                      Click "Show Results" to view the full-screen results display.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Poll Preview/Results */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {pollResults ? 'Live Results' : 'Poll Preview'}
              </h3>
              
              {pollResults ? (
                <div className="space-y-4">
                  {pollResults.options.map((option: string, index: number) => {
                    const votes = pollResults.stats[index] || 0
                    const percentage = pollResults.totalVotes > 0 
                      ? Math.round((votes / pollResults.totalVotes) * 100) 
                      : 0
                    const isMax = votes === Math.max(...pollResults.stats) && votes > 0
                    
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
              ) : (
                <div className="space-y-3">
                  {poll.options.map((option, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="font-medium text-gray-800">{option}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={goBack}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Create Poll</h1>
          <div></div>
        </div>

        {/* Poll Details */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Poll Question</h2>
            <button
              onClick={addSamplePoll}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
            >
              Load Sample Poll
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question *
              </label>
              <input
                type="text"
                value={poll.question}
                onChange={(e) => setPoll(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Enter your poll question..."
                className="input-field"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Limit (optional)
                </label>
                <select
                  value={poll.timeLimit || ''}
                  onChange={(e) => setPoll(prev => ({ 
                    ...prev, 
                    timeLimit: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="input-field"
                >
                  <option value="">No time limit</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes (recommended)</option>
                  <option value={600}>10 minutes</option>
                  <option value={60}>1 minute</option>
                  <option value={30}>30 seconds (testing only)</option>
                </select>
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={poll.allowMultipleChoices}
                    onChange={(e) => setPoll(prev => ({ ...prev, allowMultipleChoices: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Allow multiple choices</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={poll.isAnonymous}
                    onChange={(e) => setPoll(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Anonymous voting</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Options</h2>
            <button
              onClick={addOption}
              disabled={poll.options.length >= 10}
              className="btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Option
            </button>
          </div>

          <div className="space-y-4">
            {poll.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}...`}
                  className="input-field flex-1"
                />
                {poll.options.length > 2 && (
                  <button
                    onClick={() => removeOption(index)}
                    className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create Poll Button */}
        <div className="text-center">
          <button
            onClick={createPoll}
            disabled={!poll.question.trim() || poll.options.filter(opt => opt.trim()).length < 2}
            className="btn-primary text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BarChart3 className="w-5 h-5 mr-2 inline" />
            Create Poll
          </button>
        </div>
      </div>
    </div>
  )
}
