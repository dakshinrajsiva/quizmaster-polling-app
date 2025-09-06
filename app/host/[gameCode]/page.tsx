'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Play, Pause, SkipForward, Users, Trophy, Clock, ArrowLeft } from 'lucide-react'
import socketManager from '@/lib/socket-manager'
import { GameRoom, Question, QuestionResult } from '@/types/quiz'
import { getAnswerOptionLabel, formatTime } from '@/lib/utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function HostGamePage() {
  const params = useParams()
  const router = useRouter()
  const gameCode = params?.gameCode as string
  
  const [socket, setSocket] = useState<any>(null)
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [gameStatus, setGameStatus] = useState<'waiting' | 'active' | 'results' | 'finished'>('waiting')
  const [questionResults, setQuestionResults] = useState<QuestionResult | null>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [answersCount, setAnswersCount] = useState(0)

  useEffect(() => {
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)

    // Wait for connection before requesting game state
    const requestGameState = () => {
      console.log('Requesting game state for:', gameCode)
      socketInstance.emit('get-game-state', { gameCode })
    }

    if (socketInstance.connected) {
      requestGameState()
    } else {
      socketInstance.on('connect', requestGameState)
    }

    socketInstance.on('game-state', (data: any) => {
      setRoom(data.room)
      if (data.room.status === 'active' && data.room.currentQuestionIndex >= 0) {
        setCurrentQuestion(data.room.quiz.questions[data.room.currentQuestionIndex])
        setGameStatus('active')
      }
    })

    socketInstance.on('player-joined', (data: any) => {
      setRoom(prev => prev ? { ...prev, players: data.players } : null)
    })

    socketInstance.on('player-left', (data: any) => {
      setRoom(prev => prev ? { ...prev, players: data.players } : null)
    })

    socketInstance.on('answer-submitted', (data: any) => {
      setAnswersCount(data.answersCount)
    })

    socketInstance.on('question-results', (data: any) => {
      setQuestionResults(data.results)
      setLeaderboard(data.leaderboard)
      setGameStatus('results')
      setAnswersCount(0)
    })

    socketInstance.on('game-finished', (data: any) => {
      setLeaderboard(data.leaderboard)
      setGameStatus('finished')
    })

    return () => {
      // Clean up event listeners but don't disconnect socket
      socketInstance.off('connect', requestGameState)
      socketInstance.off('game-state')
      socketInstance.off('player-joined')
      socketInstance.off('player-left')
      socketInstance.off('answer-submitted')
      socketInstance.off('question-results')
      socketInstance.off('game-finished')
    }
  }, [gameCode])

  // Timer effect
  useEffect(() => {
    if (gameStatus === 'active' && currentQuestion && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleEndQuestion()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [gameStatus, currentQuestion, timeRemaining])

  const startGame = () => {
    console.log('Start game clicked')
    console.log('Room:', room)
    console.log('Socket connected:', socket?.connected)
    
    if (!room || room.players.length === 0) {
      console.log('Cannot start game: no room or no players')
      return
    }
    
    console.log('Emitting start-game event for gameCode:', gameCode)
    socket?.emit('start-game', { gameCode })
    setGameStatus('active')
    setCurrentQuestion(room.quiz.questions[0])
    setTimeRemaining(room.quiz.questions[0].timeLimit)
    setAnswersCount(0)
  }

  const handleEndQuestion = () => {
    socket?.emit('end-question', { gameCode })
  }

  const nextQuestion = () => {
    socket?.emit('next-question', { gameCode })
    setQuestionResults(null)
    
    if (room && room.currentQuestionIndex + 1 < room.quiz.questions.length) {
      const nextQ = room.quiz.questions[room.currentQuestionIndex + 1]
      setCurrentQuestion(nextQ)
      setTimeRemaining(nextQ.timeLimit)
      setGameStatus('active')
      setAnswersCount(0)
    }
  }

  const goBack = () => {
    router.push('/host')
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game...</p>
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
            Exit Game
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">{room.quiz.title}</h1>
            <p className="text-gray-600">Game Code: <span className="font-mono font-bold">{gameCode}</span></p>
          </div>
          <div className="flex items-center text-primary-600">
            <Users className="w-5 h-5 mr-2" />
            <span className="font-semibold">{room.players.length}</span>
          </div>
        </div>

        {/* Game Status */}
        {gameStatus === 'waiting' && (
          <div className="card text-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Ready to Start?</h2>
            <p className="text-gray-600 mb-6">
              {room.players.length} player{room.players.length !== 1 ? 's' : ''} joined
            </p>
            <button
              onClick={startGame}
              disabled={room.players.length === 0}
              className="btn-success text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5 mr-2 inline" />
              Start Game
            </button>
          </div>
        )}

        {/* Active Question */}
        {gameStatus === 'active' && currentQuestion && (
          <div className="space-y-6">
            {/* Question Progress */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600">
                  Question {room.currentQuestionIndex + 1} of {room.quiz.questions.length}
                </span>
                <div className="flex items-center text-primary-600">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="font-mono font-bold text-lg">{formatTime(timeRemaining)}</span>
                </div>
              </div>
              
              <div className="bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-primary-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(timeRemaining / currentQuestion.timeLimit) * 100}%` }}
                />
              </div>

              <h2 className="text-xl font-bold text-gray-800 mb-6">{currentQuestion.question}</h2>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {currentQuestion.options.map((option, index) => (
                  <div
                    key={index}
                    className={`answer-option answer-option-${['a', 'b', 'c', 'd'][index]}`}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-white bg-opacity-50 flex items-center justify-center font-bold mr-3">
                        {getAnswerOptionLabel(index)}
                      </div>
                      <span className="font-medium">{option}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {answersCount} of {room.players.length} players answered
                </div>
                <button
                  onClick={handleEndQuestion}
                  className="btn-warning"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  End Question
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Question Results */}
        {gameStatus === 'results' && questionResults && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Question Results</h2>
              
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-4">{questionResults.question}</h3>
                
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {questionResults.options.map((option, index) => (
                    <div
                      key={index}
                      className={`answer-option ${
                        index === questionResults.correctAnswer 
                          ? 'answer-option-correct' 
                          : 'bg-gray-100 border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-white bg-opacity-30 flex items-center justify-center font-bold mr-3">
                            {getAnswerOptionLabel(index)}
                          </div>
                          <span className="font-medium">{option}</span>
                        </div>
                        <div className="text-sm font-bold">
                          {questionResults.stats[index]} votes
                        </div>
                      </div>
                      <div className="mt-2 bg-white bg-opacity-30 rounded-full h-2">
                        <div
                          className="bg-white h-2 rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${room.players.length > 0 ? (questionResults.stats[index] / room.players.length) * 100 : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                {room.currentQuestionIndex + 1 < room.quiz.questions.length ? (
                  <button onClick={nextQuestion} className="btn-primary text-lg">
                    <SkipForward className="w-5 h-5 mr-2 inline" />
                    Next Question
                  </button>
                ) : (
                  <button onClick={nextQuestion} className="btn-success text-lg">
                    <Trophy className="w-5 h-5 mr-2 inline" />
                    Show Final Results
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Final Results */}
        {gameStatus === 'finished' && (
          <div className="card text-center">
            <div className="mb-8">
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Game Complete!</h2>
              <p className="text-gray-600">Final Leaderboard</p>
            </div>

            <div className="max-w-md mx-auto space-y-3">
              {leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0 
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white' 
                      : index === 1
                      ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-white'
                      : index === 2
                      ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-white bg-opacity-30 flex items-center justify-center font-bold mr-3">
                      {index + 1}
                    </div>
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <span className="font-bold">{player.score}</span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <button onClick={goBack} className="btn-primary text-lg">
                Create New Game
              </button>
            </div>
          </div>
        )}

        {/* Current Leaderboard */}
        {gameStatus !== 'waiting' && gameStatus !== 'finished' && leaderboard.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Current Standings</h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((player, index) => (
                <div key={player.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center">
                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                      {index + 1}
                    </span>
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <span className="font-bold text-primary-600">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
