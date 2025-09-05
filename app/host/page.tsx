'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit3, Play, Users, Clock, ArrowLeft } from 'lucide-react'
import { Quiz, Question } from '@/types/quiz'
import { generateGameCode } from '@/lib/utils'
import socketManager from '@/lib/socket-manager'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function HostPage() {
  const router = useRouter()
  const [currentView, setCurrentView] = useState<'create' | 'lobby'>('create')
  const [quiz, setQuiz] = useState<Quiz>({
    id: '',
    title: '',
    description: '',
    questions: [],
    createdAt: new Date()
  })

  // Add sample quiz for testing
  const addSampleQuiz = () => {
    setQuiz({
      id: uuidv4(),
      title: 'Sample Quiz',
      description: 'A quick test quiz',
      questions: [
        {
          id: uuidv4(),
          question: 'What is 2 + 2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: 1,
          timeLimit: 15
        },
        {
          id: uuidv4(),
          question: 'Which planet is closest to the Sun?',
          options: ['Venus', 'Mercury', 'Earth', 'Mars'],
          correctAnswer: 1,
          timeLimit: 20
        }
      ],
      createdAt: new Date()
    })
  }
  const [gameCode, setGameCode] = useState('')
  const [players, setPlayers] = useState<any[]>([])
  const [socket, setSocket] = useState<any>(null)

  useEffect(() => {
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)

    socketInstance.on('game-created', (data: any) => {
      console.log('Game created:', data)
      setGameCode(data.gameCode)
      socketManager.setGameCode(data.gameCode)
      setCurrentView('lobby')
    })

    socketInstance.on('player-joined', (data: any) => {
      setPlayers(data.players)
    })

    socketInstance.on('player-left', (data: any) => {
      setPlayers(data.players)
    })

    return () => {
      // Don't disconnect - let socket manager handle it
      socketInstance.off('game-created')
      socketInstance.off('player-joined')
      socketInstance.off('player-left')
    }
  }, [])

  const addQuestion = () => {
    const newQuestion: Question = {
      id: uuidv4(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      timeLimit: 30
    }
    setQuiz(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }))
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }))
  }

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === questionIndex 
          ? { ...q, options: q.options.map((opt, j) => j === optionIndex ? value : opt) }
          : q
      )
    }))
  }

  const deleteQuestion = (index: number) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }))
  }

  const createGame = () => {
    console.log('Create game clicked')
    console.log('Quiz state:', quiz)
    console.log('Socket state:', socket)
    
    if (!quiz.title.trim() || quiz.questions.length === 0) {
      alert('Please add a title and at least one question')
      return
    }

    // Validate questions
    const invalidQuestions = quiz.questions.some(q => 
      !q.question.trim() || 
      q.options.some(opt => !opt.trim()) ||
      q.correctAnswer < 0 || 
      q.correctAnswer >= q.options.length
    )

    if (invalidQuestions) {
      alert('Please complete all questions with valid options and correct answers')
      return
    }

    console.log('Emitting create-game event')
    socket?.emit('create-game', {
      quiz: {
        ...quiz,
        id: uuidv4(),
        createdAt: new Date()
      },
      hostName: 'Quiz Host'
    })
  }

  const startGame = () => {
    if (players.length === 0) {
      alert('Wait for players to join before starting')
      return
    }
    
    router.push(`/host/${gameCode}`)
  }

  const goBack = () => {
    if (currentView === 'lobby') {
      setCurrentView('create')
      setGameCode('')
      setPlayers([])
    } else {
      router.push('/')
    }
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
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{quiz.title}</h1>
              <p className="text-gray-600">{quiz.description}</p>
            </div>
            <div></div>
          </div>

          {/* Game Code */}
          <div className="card text-center mb-8 animate-pulse-glow">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Game Code</h2>
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-6xl font-bold py-6 px-8 rounded-lg inline-block tracking-widest">
              {gameCode}
            </div>
            <p className="text-gray-600 mt-4">Share this code with your players</p>
          </div>

          {/* Players */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Players</h3>
                <div className="flex items-center text-primary-600">
                  <Users className="w-5 h-5 mr-2" />
                  <span className="font-semibold">{players.length}</span>
                </div>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {players.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Waiting for players to join...</p>
                  </div>
                ) : (
                  players.map((player, index) => (
                    <div key={player.id} className="flex items-center p-3 bg-gray-50 rounded-lg animate-slide-up">
                      <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{player.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quiz Info */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Quiz Details</h3>
              <div className="space-y-4">
                <div className="flex items-center text-gray-600">
                  <Edit3 className="w-5 h-5 mr-3" />
                  <span>{quiz.questions.length} Questions</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Clock className="w-5 h-5 mr-3" />
                  <span>{quiz.questions.reduce((acc, q) => acc + q.timeLimit, 0)} seconds total</span>
                </div>
              </div>

              <button
                onClick={startGame}
                disabled={players.length === 0}
                className="btn-success w-full mt-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5 mr-2 inline" />
                Start Game
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
          <h1 className="text-3xl font-bold text-gray-800">Create Quiz</h1>
          <div></div>
        </div>

        {/* Quiz Details */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Quiz Information</h2>
            <button
              onClick={addSampleQuiz}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
            >
              Load Sample Quiz
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quiz Title *
              </label>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter quiz title..."
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={quiz.description}
                onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter quiz description..."
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Questions</h2>
            <button
              onClick={addQuestion}
              className="btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </button>
          </div>

          <div className="space-y-6">
            {quiz.questions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Edit3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No questions yet</p>
                <p className="text-sm">Add your first question to get started</p>
              </div>
            ) : (
              quiz.questions.map((question, questionIndex) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">
                      Question {questionIndex + 1}
                    </h3>
                    <button
                      onClick={() => deleteQuestion(questionIndex)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Question *
                      </label>
                      <input
                        type="text"
                        value={question.question}
                        onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                        placeholder="Enter your question..."
                        className="input-field"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Option {String.fromCharCode(65 + optionIndex)} *
                            {question.correctAnswer === optionIndex && (
                              <span className="text-green-600 ml-2">(Correct)</span>
                            )}
                          </label>
                          <div className="flex">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateQuestionOption(questionIndex, optionIndex, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + optionIndex)}...`}
                              className="input-field flex-1"
                            />
                            <button
                              onClick={() => updateQuestion(questionIndex, 'correctAnswer', optionIndex)}
                              className={`ml-2 px-3 py-2 rounded-lg border-2 transition-all ${
                                question.correctAnswer === optionIndex
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-green-500 text-gray-600'
                              }`}
                            >
                              ✓
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center space-x-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Time Limit (seconds)
                        </label>
                        <select
                          value={question.timeLimit}
                          onChange={(e) => updateQuestion(questionIndex, 'timeLimit', parseInt(e.target.value))}
                          className="input-field w-32"
                        >
                          <option value={10}>10s</option>
                          <option value={15}>15s</option>
                          <option value={20}>20s</option>
                          <option value={30}>30s</option>
                          <option value={45}>45s</option>
                          <option value={60}>60s</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Create Game Button */}
        <div className="text-center">
          <button
            onClick={createGame}
            disabled={!quiz.title.trim() || quiz.questions.length === 0}
            className="btn-primary text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5 mr-2 inline" />
            Create Game
          </button>
        </div>
      </div>
    </div>
  )
}
