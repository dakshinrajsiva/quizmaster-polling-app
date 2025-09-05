'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Users, Clock, ArrowLeft, BarChart3, Eye, EyeOff } from 'lucide-react'
import { Poll } from '@/types/quiz'
import socketManager from '@/lib/socket-manager'
import { v4 as uuidv4 } from 'uuid'

export default function PollPage() {
  const router = useRouter()
  const [currentView, setCurrentView] = useState<'create' | 'lobby'>('create')
  const [poll, setPoll] = useState<Poll>({
    id: '',
    question: '',
    options: ['', ''],
    allowMultipleChoices: false,
    isAnonymous: true,
    timeLimit: undefined,
    createdAt: new Date(),
    createdBy: ''
  })
  const [pollCode, setPollCode] = useState('')
  const [participants, setParticipants] = useState<any[]>([])
  const [socket, setSocket] = useState<any>(null)

  useEffect(() => {
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)

    socketInstance.on('poll-created', (data: any) => {
      console.log('Poll created:', data)
      setPollCode(data.pollCode)
      socketManager.setGameCode(data.pollCode)
      setCurrentView('lobby')
    })

    socketInstance.on('participant-joined', (data: any) => {
      setParticipants(data.participants)
    })

    socketInstance.on('participant-left', (data: any) => {
      setParticipants(data.participants)
    })

    return () => {
      socketInstance.off('poll-created')
      socketInstance.off('participant-joined')
      socketInstance.off('participant-left')
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
    console.log('Create poll clicked')
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

    console.log('Emitting create-poll event')
    socket?.emit('create-poll', {
      poll: {
        ...poll,
        id: uuidv4(),
        options: validOptions,
        createdAt: new Date()
      },
      hostName: 'Poll Host'
    })
  }

  const startPoll = () => {
    if (participants.length === 0) {
      alert('Wait for participants to join before starting')
      return
    }
    
    router.push(`/poll/${pollCode}`)
  }

  const goBack = () => {
    if (currentView === 'lobby') {
      setCurrentView('create')
      setPollCode('')
      setParticipants([])
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
      timeLimit: 60,
      createdAt: new Date(),
      createdBy: 'Poll Host'
    })
  }

  if (currentView === 'lobby') {
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

          {/* Poll Code */}
          <div className="card text-center mb-8 animate-pulse-glow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Poll Code</h2>
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-6xl font-bold py-6 px-8 rounded-lg inline-block tracking-widest">
              {pollCode}
            </div>
            <p className="text-gray-600 mt-4">Share this code with your participants</p>
          </div>

          {/* Participants */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Participants</h3>
                <div className="flex items-center text-primary-600">
                  <Users className="w-5 h-5 mr-2" />
                  <span className="font-semibold">{participants.length}</span>
                </div>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {participants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Waiting for participants to join...</p>
                  </div>
                ) : (
                  participants.map((participant) => (
                    <div key={participant.id} className="flex items-center p-3 bg-gray-50 rounded-lg animate-slide-up">
                      <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{participant.name}</span>
                      {participant.hasVoted && (
                        <span className="ml-auto text-green-600 text-sm">✓ Voted</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Poll Preview */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Poll Preview</h3>
              <div className="space-y-3">
                {poll.options.map((option, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="font-medium text-gray-800">{option}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={startPoll}
                disabled={participants.length === 0}
                className="btn-success w-full mt-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BarChart3 className="w-5 h-5 mr-2 inline" />
                Start Poll
              </button>
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
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
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
