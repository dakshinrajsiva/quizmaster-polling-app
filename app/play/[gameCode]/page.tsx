'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, Clock, Trophy, Zap, ArrowLeft, CheckCircle } from 'lucide-react'
import socketManager from '@/lib/socket-manager'
import { Question, Player } from '@/types/quiz'
import { getAnswerOptionLabel, getAnswerOptionClass, formatTime } from '@/lib/utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function PlayGamePage() {
  const params = useParams()
  const router = useRouter()
  const gameCode = params.gameCode as string
  
  const [socket, setSocket] = useState<any>(null)
  const [gameStatus, setGameStatus] = useState<'joining' | 'waiting' | 'active' | 'answered' | 'results' | 'finished'>('joining')
  const [player, setPlayer] = useState<Player | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [questionResults, setQuestionResults] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const socketInstance = socketManager.connect()
    setSocket(socketInstance)

    socketInstance.on('join-success', (data: any) => {
      setPlayer(data.player)
      setPlayers(data.room.players)
      setGameStatus('waiting')
      setError('')
    })

    socketInstance.on('join-error', (data: any) => {
      setError(data.message)
    })

    socketInstance.on('player-joined', (data: any) => {
      setPlayers(data.players)
    })

    socketInstance.on('player-left', (data: any) => {
      setPlayers(data.players)
    })

    socketInstance.on('game-started', (data: any) => {
      setGameStatus('active')
      setTotalQuestions(data.totalQuestions)
    })

    socketInstance.on('new-question', (data: any) => {
      setCurrentQuestion(data)
      setQuestionNumber(data.questionNumber)
      setTotalQuestions(data.totalQuestions)
      setTimeRemaining(data.timeLimit)
      setSelectedAnswer(null)
      setGameStatus('active')
      setQuestionResults(null)
    })

    socketInstance.on('question-results', (data: any) => {
      setQuestionResults(data.results)
      setLeaderboard(data.leaderboard)
      setGameStatus('results')
    })

    socketInstance.on('game-finished', (data: any) => {
      setLeaderboard(data.leaderboard)
      setGameStatus('finished')
    })

    socketInstance.on('host-disconnected', () => {
      setError('Host has disconnected. Game ended.')
      setTimeout(() => router.push('/'), 3000)
    })

    return () => {
      // Clean up event listeners but don't disconnect socket
      socketInstance.off('join-success')
      socketInstance.off('join-error')
      socketInstance.off('player-joined')
      socketInstance.off('player-left')
      socketInstance.off('game-started')
      socketInstance.off('new-question')
      socketInstance.off('question-results')
      socketInstance.off('game-finished')
      socketInstance.off('host-disconnected')
    }
  }, [router])

  // Timer effect
  useEffect(() => {
    if (gameStatus === 'active' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1))
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [gameStatus, timeRemaining])

  const joinGame = () => {
    socket?.emit('join-game', {
      gameCode: gameCode.toUpperCase()
    })
  }

  const submitAnswer = (answerIndex: number) => {
    if (gameStatus !== 'active' || !player || selectedAnswer !== null) return
    
    setSelectedAnswer(answerIndex)
    setGameStatus('answered')
    
    socket?.emit('submit-answer', {
      gameCode: gameCode.toUpperCase(),
      playerId: player.id,
      answerIndex,
      timeRemaining
    })
  }

  const goBack = () => {
    router.push('/')
  }

  const getPlayerRank = () => {
    if (!player) return null
    const rank = leaderboard.findIndex(p => p.id === player.id) + 1
    return rank > 0 ? rank : null
  }

  // Joining screen
  if (gameStatus === 'joining') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <div className="mb-6">
              <div className="bg-primary-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-primary-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Join Game</h1>
              <p className="text-gray-600">Game Code: <span className="font-mono font-bold">{gameCode}</span></p>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="text-center text-gray-600 mb-4">
                <p>Click below to join the quiz anonymously</p>
                <p className="text-sm text-gray-500">You'll be identified by your session</p>
              </div>
              <button
                onClick={joinGame}
                className="btn-primary w-full text-lg"
              >
                Join Game
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

  // Waiting for game to start
  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Waiting for Game to Start</h1>
            <p className="text-gray-600">Game Code: <span className="font-mono font-bold text-lg">{gameCode}</span></p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">You're In!</h2>
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
                  {player?.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-lg font-semibold text-gray-800">{player?.name}</h3>
              </div>
              <div className="text-center text-gray-600">
                <Zap className="w-8 h-8 mx-auto mb-2 text-primary-500" />
                <p>Ready to play!</p>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Players</h2>
                <div className="flex items-center text-primary-600">
                  <Users className="w-5 h-5 mr-2" />
                  <span className="font-semibold">{players.length}</span>
                </div>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {players.map((p) => (
                  <div key={p.id} className={`flex items-center p-3 rounded-lg ${
                    p.id === player?.id ? 'bg-primary-100 border-2 border-primary-300' : 'bg-gray-50'
                  }`}>
                    <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">{p.name}</span>
                    {p.id === player?.id && (
                      <span className="ml-auto text-primary-600 text-sm font-medium">You</span>
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

  // Active question
  if ((gameStatus === 'active' || gameStatus === 'answered') && currentQuestion) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">
                Question {questionNumber} of {totalQuestions}
              </span>
              <div className="flex items-center text-primary-600">
                <Clock className="w-4 h-4 mr-1" />
                <span className="font-mono font-bold text-lg">{formatTime(timeRemaining)}</span>
              </div>
            </div>
            
            <div className="bg-gray-200 rounded-full h-2 mb-6">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(timeRemaining / currentQuestion.timeLimit) * 100}%` }}
              />
            </div>

            <h1 className="text-2xl font-bold text-gray-800">{currentQuestion.question}</h1>
          </div>

          {gameStatus === 'answered' ? (
            <div className="card text-center">
              <div className="mb-6">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Answer Submitted!</h2>
                <p className="text-gray-600">Waiting for other players...</p>
              </div>
              
              {selectedAnswer !== null && (
                <div className="max-w-md mx-auto">
                  <p className="text-sm text-gray-600 mb-2">Your answer:</p>
                  <div className={`answer-option ${getAnswerOptionClass(selectedAnswer)} answer-option-selected`}>
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-white bg-opacity-50 flex items-center justify-center font-bold mr-3">
                        {getAnswerOptionLabel(selectedAnswer)}
                      </div>
                      <span className="font-medium">{currentQuestion.options[selectedAnswer]}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => submitAnswer(index)}
                  disabled={timeRemaining === 0}
                  className={`answer-option ${getAnswerOptionClass(index)} hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-white bg-opacity-50 flex items-center justify-center font-bold mr-3">
                      {getAnswerOptionLabel(index)}
                    </div>
                    <span className="font-medium text-left">{option}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Question results
  if (gameStatus === 'results' && questionResults) {
    const isCorrect = selectedAnswer === questionResults.correctAnswer
    const playerRank = getPlayerRank()
    
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
              isCorrect ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {isCorrect ? (
                <CheckCircle className="w-10 h-10 text-white" />
              ) : (
                <span className="text-white text-3xl">✕</span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {isCorrect ? 'Correct!' : 'Wrong Answer'}
            </h1>
            <p className="text-gray-600">Question {questionNumber} Results</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="card">
              <h2 className="text-lg font-bold text-gray-800 mb-4">{questionResults.question}</h2>
              
              <div className="space-y-3">
                {questionResults.options.map((option: string, index: number) => (
                  <div
                    key={index}
                    className={`answer-option ${
                      index === questionResults.correctAnswer
                        ? 'answer-option-correct'
                        : selectedAnswer === index
                        ? 'answer-option-incorrect'
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
                        {questionResults.stats[index]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Leaderboard</h2>
              
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((p: any, index: number) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      p.id === player?.id ? 'bg-primary-100 border-2 border-primary-300' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                        index === 0 ? 'bg-yellow-400 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-yellow-600 text-white' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="font-medium">{p.name}</span>
                      {p.id === player?.id && (
                        <span className="ml-2 text-primary-600 text-sm">(You)</span>
                      )}
                    </div>
                    <span className="font-bold text-primary-600">{p.score}</span>
                  </div>
                ))}
              </div>

              {playerRank && (
                <div className="mt-4 text-center p-3 bg-primary-50 rounded-lg">
                  <p className="text-sm text-primary-600">
                    Your rank: <span className="font-bold">#{playerRank}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Final results
  if (gameStatus === 'finished') {
    const playerRank = getPlayerRank()
    const playerScore = player ? leaderboard.find(p => p.id === player.id)?.score || 0 : 0
    
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Game Complete!</h1>
            <div className="card inline-block">
              <h2 className="text-2xl font-bold text-primary-600 mb-2">Your Result</h2>
              <div className="flex items-center justify-center space-x-6">
                <div>
                  <div className="text-3xl font-bold text-gray-800">{playerScore}</div>
                  <div className="text-sm text-gray-600">Points</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-800">#{playerRank || '-'}</div>
                  <div className="text-sm text-gray-600">Rank</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Final Leaderboard</h2>
            <div className="space-y-3">
              {leaderboard.map((p: any, index: number) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0 
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white' 
                      : index === 1
                      ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-white'
                      : index === 2
                      ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white'
                      : p.id === player?.id
                      ? 'bg-primary-100 border-2 border-primary-300'
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-white bg-opacity-30 flex items-center justify-center font-bold mr-3">
                      {index + 1}
                    </div>
                    <span className="font-medium">{p.name}</span>
                    {p.id === player?.id && (
                      <span className="ml-2 text-primary-600 text-sm font-medium">(You)</span>
                    )}
                  </div>
                  <span className="font-bold">{p.score}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <button onClick={goBack} className="btn-primary text-lg">
              Play Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
