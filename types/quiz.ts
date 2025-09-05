export interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  timeLimit: number // in seconds
}

export interface Quiz {
  id: string
  title: string
  description: string
  questions: Question[]
  createdAt: Date
}

export interface Player {
  id: string
  name: string
  score: number
  avatar?: string
  joinedAt: Date
}

export interface GameRoom {
  id: string
  quiz: Quiz
  host: string
  players: Player[]
  currentQuestionIndex: number
  status: 'waiting' | 'active' | 'question' | 'results' | 'finished'
  questionStartTime?: Date
  answers: Record<string, number> // playerId -> answerIndex
  createdAt: Date
}

export interface GameState {
  room: GameRoom
  currentQuestion?: Question
  timeRemaining: number
  showResults: boolean
  leaderboard: Player[]
}

export interface QuestionResult {
  questionId: string
  question: string
  correctAnswer: number
  options: string[]
  playerAnswers: Record<string, number>
  correctPlayers: string[]
  stats: number[] // count for each option
}

export interface Poll {
  id: string
  question: string
  options: string[]
  allowMultipleChoices: boolean
  isAnonymous: boolean
  timeLimit?: number // in seconds, optional for unlimited time
  createdAt: Date
  createdBy: string
}

export interface PollRoom {
  id: string
  poll: Poll
  host: string
  hostName: string
  participants: Participant[]
  status: 'waiting' | 'active' | 'closed'
  votes: Record<string, number[]> // participantId -> selected option indices
  createdAt: Date
}

export interface Participant {
  id: string
  name: string
  joinedAt: Date
  hasVoted: boolean
}

export interface PollResult {
  pollId: string
  question: string
  options: string[]
  votes: Record<string, number[]> // participantId -> selected options
  stats: number[] // count for each option
  totalVotes: number
  participantCount: number
  isAnonymous: boolean
}
