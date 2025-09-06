const { createServer } = require('http')
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid')

console.log('Socket.io server starting...')

const httpServer = createServer()
const allowedOrigins = {
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  production: [
    process.env.CLIENT_URL,
    'https://quizmaster-6fskhlzqt-dakshin-raj-sivas-projects.vercel.app',
    'https://quizmaster-bx3jjp997-dakshin-raj-sivas-projects.vercel.app',
    'https://quizmaster-ivory.vercel.app',
    'https://quizmaster-7iqxt45yp-dakshin-raj-sivas-projects.vercel.app',
    'https://quizmaster-bovprht3g-dakshin-raj-sivas-projects.vercel.app',
    'https://quizmaster-8ylo882qc-dakshin-raj-sivas-projects.vercel.app',
    'https://quizmaster-m7kfsy8zr-dakshin-raj-sivas-projects.vercel.app'
  ].filter(Boolean)
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowed = allowedOrigins[process.env.NODE_ENV] || allowedOrigins.development;

      // Allow no origin (mobile apps, server-to-server)
      if (!origin) return callback(null, true);

      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    optionsSuccessStatus: 200
  },
  // Enable both WebSocket and long polling
  transports: ['websocket', 'polling'],
  // Long polling configuration
  pingTimeout: 60000,
  pingInterval: 25000,
  // Connection limits for production
  maxHttpBufferSize: 1e6, // 1MB
  // Graceful handling of disconnections
  allowEIO3: true,
  // Production optimizations
  serveClient: false,
  // Rate limiting
  connectTimeout: 45000,
  // Enable compression
  compression: true,
  // Heartbeat configuration
  heartbeatTimeout: 60000,
  heartbeatInterval: 25000
})

// In-memory storage (in production, use Redis or a database)
const gameRooms = new Map()
const playerSockets = new Map() // playerId -> socketId
const pollRooms = new Map() // pollCode -> pollRoom
const participantSockets = new Map() // participantId -> socketId

// Connection management for production
const connectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  maxConnections: 200, // Increased for testing - can handle more users
  connectionsPerIP: new Map(),
  maxConnectionsPerIP: 50 // Increased for testing multiple tabs from same IP
}

// Rate limiting (relaxed for testing)
const rateLimits = new Map() // socketId -> { requests: [], lastReset: timestamp }
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 500 // Increased for testing - Max requests per minute per connection

// Connection cleanup interval
setInterval(() => {
  // Clean up old rate limit data
  const now = Date.now()
  for (const [socketId, data] of rateLimits.entries()) {
    if (now - data.lastReset > RATE_LIMIT_WINDOW * 2) {
      rateLimits.delete(socketId)
    }
  }

  // Clean up old connection stats
  for (const [ip, count] of connectionStats.connectionsPerIP.entries()) {
    if (count <= 0) {
      connectionStats.connectionsPerIP.delete(ip)
    }
  }
}, 300000) // Clean up every 5 minutes

// Utility functions
function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function calculateScore(isCorrect, timeRemaining, totalTime) {
  if (!isCorrect) return 0
  const baseScore = 1000
  const timeBonus = Math.floor((timeRemaining / totalTime) * 500)
  return baseScore + timeBonus
}

function getLeaderboard(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({
      ...player,
      rank: index + 1
    }))
}

// Rate limiting middleware
function checkRateLimit(socket) {
  const now = Date.now()
  const socketId = socket.id

  if (!rateLimits.has(socketId)) {
    rateLimits.set(socketId, {
      requests: [],
      lastReset: now
    })
  }

  const rateData = rateLimits.get(socketId)

  // Reset if window expired
  if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
    rateData.requests = []
    rateData.lastReset = now
  }

  // Add current request
  rateData.requests.push(now)

  // Remove old requests outside window
  rateData.requests = rateData.requests.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW
  )

  // Check if over limit
  if (rateData.requests.length > MAX_REQUESTS_PER_WINDOW) {
    socket.emit('rate-limit-exceeded', {
      message: 'Too many requests. Please slow down.',
      retryAfter: RATE_LIMIT_WINDOW
    })
    return false
  }

  return true
}

// Connection validation
function validateConnection(socket) {
  const clientIP = socket.handshake.address

  // Check total connections
  if (connectionStats.activeConnections >= connectionStats.maxConnections) {
    socket.emit('connection-rejected', {
      message: 'Server is at capacity. Please try again later.'
    })
    socket.disconnect(true)
    return false
  }

  // Check connections per IP
  const ipConnections = connectionStats.connectionsPerIP.get(clientIP) || 0
  if (ipConnections >= connectionStats.maxConnectionsPerIP) {
    socket.emit('connection-rejected', {
      message: 'Too many connections from your IP. Please try again later.'
    })
    socket.disconnect(true)
    return false
  }

  return true
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Validate connection
  if (!validateConnection(socket)) {
    return
  }

  // Update connection stats
  const clientIP = socket.handshake.address
  connectionStats.totalConnections++
  connectionStats.activeConnections++
  connectionStats.connectionsPerIP.set(
    clientIP,
    (connectionStats.connectionsPerIP.get(clientIP) || 0) + 1
  )

  console.log(`Connection stats: ${connectionStats.activeConnections}/${connectionStats.maxConnections} active`)

  // Add rate limiting wrapper for all events
  const originalEmit = socket.emit
  socket.emit = function(...args) {
    if (checkRateLimit(socket)) {
      return originalEmit.apply(this, args)
    }
  }

  // Host creates a new game
  socket.on('create-game', (data) => {
    console.log('Received create-game event:', data)
    const { quiz, hostName } = data
    const gameCode = generateGameCode()

    const room = {
      id: gameCode,
      quiz: {
        ...quiz,
        id: uuidv4()
      },
      host: socket.id,
      hostName,
      players: [],
      currentQuestionIndex: -1,
      status: 'waiting',
      answers: {},
      createdAt: new Date()
    }

    gameRooms.set(gameCode, room)
    socket.join(gameCode)

    console.log(`Game created with code: ${gameCode}`)
    console.log('Emitting game-created event to client')

    socket.emit('game-created', {
      gameCode,
      room
    })

    console.log(`Game created: ${gameCode}`)
  })

  // Player joins a game
  socket.on('join-game', (data) => {
    const { gameCode } = data
    const room = gameRooms.get(gameCode)

    if (!room) {
      socket.emit('join-error', { message: 'Game not found' })
      return
    }

    if (room.status !== 'waiting') {
      socket.emit('join-error', { message: 'Game has already started' })
      return
    }

    // Check if this socket is already in the game (prevent duplicates)
    if (room.players.some(p => p.socketId === socket.id)) {
      socket.emit('join-error', { message: 'You are already in this game' })
      return
    }

    const player = {
      id: uuidv4(),
      name: `Player ${room.players.length + 1}`, // Anonymous player name
      score: 0,
      socketId: socket.id,
      joinedAt: new Date()
    }

    room.players.push(player)
    playerSockets.set(player.id, socket.id)
    socket.join(gameCode)

    // Notify all players and host
    io.to(gameCode).emit('player-joined', {
      player,
      players: room.players,
      playerCount: room.players.length
    })

    socket.emit('join-success', {
      player,
      room: {
        id: room.id,
        quiz: { title: room.quiz.title, description: room.quiz.description },
        players: room.players,
        status: room.status
      }
    })

    console.log(`Player ${player.name} (${socket.id}) joined game ${gameCode}`)
  })

  // Host starts the game
  socket.on('start-game', (data) => {
    console.log('Received start-game event:', data)
    const { gameCode } = data
    const room = gameRooms.get(gameCode)

    console.log('Room found:', !!room)
    console.log('Host match:', room?.host === socket.id)
    console.log('Players count:', room?.players.length || 0)

    if (!room || room.host !== socket.id) {
      console.log('Error: Unauthorized or game not found')
      socket.emit('error', { message: 'Unauthorized or game not found' })
      return
    }

    if (room.players.length === 0) {
      console.log('Error: No players to start the game')
      socket.emit('error', { message: 'No players to start the game' })
      return
    }

    room.status = 'active'
    room.currentQuestionIndex = 0
    room.answers = {}

    const currentQuestion = room.quiz.questions[0]
    room.questionStartTime = new Date()

    // Start first question
    io.to(gameCode).emit('game-started', {
      status: room.status,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.quiz.questions.length
    })

    // Send question to all players (without correct answer)
    const questionForPlayers = {
      id: currentQuestion.id,
      question: currentQuestion.question,
      options: currentQuestion.options,
      timeLimit: currentQuestion.timeLimit,
      questionNumber: room.currentQuestionIndex + 1,
      totalQuestions: room.quiz.questions.length
    }

    io.to(gameCode).emit('new-question', questionForPlayers)

    // Auto-advance after time limit
    setTimeout(() => {
      if (room.status === 'active' && room.currentQuestionIndex === 0) {
        socket.emit('end-question', { gameCode })
      }
    }, currentQuestion.timeLimit * 1000)

    console.log(`Game ${gameCode} started`)
  })

  // Player submits an answer
  socket.on('submit-answer', (data) => {
    const { gameCode, playerId, answerIndex, timeRemaining } = data
    const room = gameRooms.get(gameCode)

    if (!room || room.status !== 'active') {
      return
    }

    // Record the answer
    room.answers[playerId] = {
      answerIndex,
      timeRemaining,
      submittedAt: new Date()
    }

    const currentQuestion = room.quiz.questions[room.currentQuestionIndex]
    const isCorrect = answerIndex === currentQuestion.correctAnswer

    // Calculate score
    if (isCorrect) {
      const player = room.players.find(p => p.id === playerId)
      if (player) {
        const score = calculateScore(isCorrect, timeRemaining, currentQuestion.timeLimit)
        player.score += score
      }
    }

    // Notify host of answer submission
    io.to(room.host).emit('answer-submitted', {
      playerId,
      playerName: room.players.find(p => p.id === playerId)?.name,
      answerIndex,
      answersCount: Object.keys(room.answers).length,
      totalPlayers: room.players.length
    })

    console.log(`Player ${playerId} answered question in game ${gameCode}`)
  })

  // Host ends current question
  socket.on('end-question', (data) => {
    const { gameCode } = data
    const room = gameRooms.get(gameCode)

    if (!room || room.host !== socket.id) {
      return
    }

    const currentQuestion = room.quiz.questions[room.currentQuestionIndex]

    // Calculate results
    const results = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      options: currentQuestion.options,
      correctAnswer: currentQuestion.correctAnswer,
      playerAnswers: {},
      correctPlayers: [],
      stats: new Array(currentQuestion.options.length).fill(0)
    }

    // Process all answers
    for (const [playerId, answer] of Object.entries(room.answers)) {
      results.playerAnswers[playerId] = answer.answerIndex
      results.stats[answer.answerIndex]++

      if (answer.answerIndex === currentQuestion.correctAnswer) {
        results.correctPlayers.push(playerId)
      }
    }

    room.status = 'results'

    // Send results to all players
    io.to(gameCode).emit('question-results', {
      results,
      leaderboard: getLeaderboard(room),
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.quiz.questions.length
    })

    console.log(`Question ${room.currentQuestionIndex + 1} ended in game ${gameCode}`)
  })

  // Host moves to next question
  socket.on('next-question', (data) => {
    const { gameCode } = data
    const room = gameRooms.get(gameCode)

    if (!room || room.host !== socket.id) {
      return
    }

    room.currentQuestionIndex++
    room.answers = {}

    if (room.currentQuestionIndex >= room.quiz.questions.length) {
      // Game finished
      room.status = 'finished'
      const finalLeaderboard = getLeaderboard(room)

      io.to(gameCode).emit('game-finished', {
        leaderboard: finalLeaderboard,
        totalQuestions: room.quiz.questions.length
      })

      console.log(`Game ${gameCode} finished`)
      return
    }

    // Start next question
    room.status = 'active'
    const currentQuestion = room.quiz.questions[room.currentQuestionIndex]
    room.questionStartTime = new Date()

    const questionForPlayers = {
      id: currentQuestion.id,
      question: currentQuestion.question,
      options: currentQuestion.options,
      timeLimit: currentQuestion.timeLimit,
      questionNumber: room.currentQuestionIndex + 1,
      totalQuestions: room.quiz.questions.length
    }

    io.to(gameCode).emit('new-question', questionForPlayers)

    // Auto-advance after time limit
    setTimeout(() => {
      if (room.status === 'active' && room.currentQuestionIndex === room.currentQuestionIndex) {
        socket.emit('end-question', { gameCode })
      }
    }, currentQuestion.timeLimit * 1000)

    console.log(`Next question started in game ${gameCode}`)
  })

  // BROADCAST POLLING SYSTEM EVENTS
  
  // Global poll state (only one active poll at a time)
  let globalPoll = null
  let globalPollParticipants = new Map() // socketId -> participant info
  let globalPollVotes = {} // optionIndex -> count
  
  // Host creates a broadcast poll
  socket.on('create-broadcast-poll', (data) => {
    console.log('🎯 Received create-broadcast-poll event:', data)
    const { poll, hostName } = data
    
    globalPoll = {
      ...poll,
      id: uuidv4(),
      host: socket.id,
      hostName,
      status: 'created',
      createdAt: new Date()
    }
    
    // Reset votes
    globalPollVotes = {}
    poll.options.forEach((_, index) => {
      globalPollVotes[index] = 0
    })
    
    console.log('✅ Broadcast poll created:', globalPoll.question)
    console.log('🎮 Host socket ID:', socket.id)
    console.log('📊 Poll options:', globalPoll.options)
    
    socket.emit('broadcast-poll-created', {
      poll: globalPoll
    })
  })
  
  // Host launches the poll (broadcasts to everyone)
  socket.on('launch-broadcast-poll', (data) => {
    console.log('🚀 Launch broadcast poll requested by:', socket.id)
    console.log('🔍 Current globalPoll:', globalPoll ? globalPoll.question : 'None')
    console.log('👤 GlobalPoll host:', globalPoll ? globalPoll.host : 'None')
    
    if (!globalPoll || globalPoll.host !== socket.id) {
      console.log('❌ Launch denied - No poll or not authorized')
      socket.emit('error', { message: 'No poll to launch or not authorized' })
      return
    }
    
    globalPoll.status = 'active'
    globalPollParticipants.clear()
    
    console.log('📡 Broadcasting poll to ALL connected users:', globalPoll.question)
    console.log('👥 Connected sockets:', io.engine.clientsCount)
    
    // Broadcast to ALL connected users
    io.emit('poll-broadcast', {
      poll: globalPoll
    })
    
    console.log(`✅ Poll "${globalPoll.question}" launched globally to ${io.engine.clientsCount} users`)
  })
  
  // Get current poll status
  socket.on('get-current-poll', () => {
    console.log('📋 Current poll requested by:', socket.id)
    console.log('📋 GlobalPoll exists:', !!globalPoll)
    console.log('📋 GlobalPoll status:', globalPoll?.status)
    console.log('📋 GlobalPoll question:', globalPoll?.question)
    if (globalPoll && globalPoll.status === 'active') {
      console.log('📋 Sending current poll:', globalPoll.question)
      socket.emit('current-poll-response', { poll: globalPoll })
    } else {
      console.log('📋 No active poll to send - Poll exists:', !!globalPoll, 'Status:', globalPoll?.status)
      socket.emit('current-poll-response', { poll: null })
    }
  })

  // User joins the broadcast poll (auto-join)
  socket.on('join-broadcast-poll', () => {
    if (!globalPoll || globalPoll.status !== 'active') {
      socket.emit('poll-join-error', { message: 'No active poll' })
      return
    }
    
    // Check if already joined
    if (globalPollParticipants.has(socket.id)) {
      socket.emit('poll-join-error', { message: 'Already joined' })
      return
    }
    
    const participant = {
      id: uuidv4(),
      name: `Participant ${globalPollParticipants.size + 1}`,
      socketId: socket.id,
      hasVoted: false,
      joinedAt: new Date()
    }
    
    globalPollParticipants.set(socket.id, participant)
    
    // Send the current poll data to the participant
    socket.emit('poll-broadcast', { poll: globalPoll })
    
    socket.emit('poll-join-success', {
      participant,
      poll: globalPoll,
      participantCount: globalPollParticipants.size
    })
    
    console.log(`${participant.name} joined broadcast poll`)
  })
  
  // User votes in broadcast poll
  socket.on('submit-broadcast-vote', (data) => {
    const { selectedOptions } = data
    
    if (!globalPoll || globalPoll.status !== 'active') {
      socket.emit('vote-error', { message: 'No active poll' })
      return
    }
    
    const participant = globalPollParticipants.get(socket.id)
    if (!participant) {
      socket.emit('vote-error', { message: 'Not joined in poll' })
      return
    }
    
    if (participant.hasVoted) {
      socket.emit('vote-error', { message: 'Already voted' })
      return
    }
    
    // Record votes
    selectedOptions.forEach(optionIndex => {
      if (optionIndex >= 0 && optionIndex < globalPoll.options.length) {
        globalPollVotes[optionIndex] = (globalPollVotes[optionIndex] || 0) + 1
      }
    })
    
    participant.hasVoted = true
    participant.vote = selectedOptions
    
    // Calculate results
    const totalVotes = Object.values(globalPollVotes).reduce((sum, count) => sum + count, 0)
    const results = {
      question: globalPoll.question,
      options: globalPoll.options,
      stats: globalPoll.options.map((_, index) => globalPollVotes[index] || 0),
      totalVotes,
      participantCount: globalPollParticipants.size
    }
    
    // Send vote confirmation to voter
    socket.emit('vote-submitted', { results })
    
    // Broadcast updated results to everyone (including host)
    io.emit('poll-results-updated', results)
    
    console.log(`Vote submitted by ${participant.name}`)
  })
  
  // Host closes the broadcast poll
  socket.on('close-broadcast-poll', () => {
    if (!globalPoll || globalPoll.host !== socket.id) {
      socket.emit('error', { message: 'Not authorized to close poll' })
      return
    }
    
    globalPoll.status = 'closed'
    
    const totalVotes = Object.values(globalPollVotes).reduce((sum, count) => sum + count, 0)
    const finalResults = {
      question: globalPoll.question,
      options: globalPoll.options,
      stats: globalPoll.options.map((_, index) => globalPollVotes[index] || 0),
      totalVotes,
      participantCount: globalPollParticipants.size
    }
    
    // Send final results to presenter first
    socket.emit('poll-final-results', finalResults)
    
    // Broadcast poll closed to everyone
    io.emit('poll-broadcast-closed', finalResults)
    
    console.log(`🏁 Broadcast poll "${globalPoll.question}" closed with final results`)
    console.log(`📊 Final Results:`, finalResults)
    
    // Reset global poll after a delay
    setTimeout(() => {
      globalPoll = null
      globalPollParticipants.clear()
      globalPollVotes = {}
    }, 5000)
  })

  // ORIGINAL POLLING SYSTEM EVENTS (keeping for backward compatibility)

  // Host creates a new poll
  socket.on('create-poll', (data) => {
    console.log('Received create-poll event:', data)
    const { poll, hostName } = data
    const pollCode = generateGameCode()

    const room = {
      id: pollCode,
      poll: {
        ...poll,
        id: uuidv4(),
        createdAt: new Date()
      },
      host: socket.id,
      hostName,
      participants: [],
      status: 'waiting',
      votes: {},
      createdAt: new Date()
    }

    pollRooms.set(pollCode, room)
    socket.join(pollCode)

    console.log(`Poll created with code: ${pollCode}`)

    socket.emit('poll-created', {
      pollCode,
      room
    })

    console.log(`Poll created: ${pollCode}`)
  })

  // Participant joins a poll
  socket.on('join-poll', (data) => {
    const { pollCode } = data
    const room = pollRooms.get(pollCode)

    if (!room) {
      socket.emit('poll-join-error', { message: 'Poll not found' })
      return
    }

    // Check if this socket is already in the poll (prevent duplicates)
    if (room.participants.some(p => p.socketId === socket.id)) {
      socket.emit('poll-join-error', { message: 'You are already in this poll' })
      return
    }

    const participant = {
      id: uuidv4(),
      name: `Participant ${room.participants.length + 1}`, // Anonymous participant name
      joinedAt: new Date(),
      hasVoted: false,
      socketId: socket.id
    }

    room.participants.push(participant)
    participantSockets.set(participant.id, socket.id)
    socket.join(pollCode)

    // Notify all participants and host
    io.to(pollCode).emit('participant-joined', {
      participant,
      participants: room.participants,
      participantCount: room.participants.length
    })

    socket.emit('poll-join-success', {
      participant,
      room: {
        id: room.id,
        poll: {
          question: room.poll.question,
          options: room.poll.options,
          allowMultipleChoices: room.poll.allowMultipleChoices,
          isAnonymous: room.poll.isAnonymous,
          timeLimit: room.poll.timeLimit
        },
        participants: room.participants,
        status: room.status
      }
    })

    console.log(`Participant ${participant.name} (${socket.id}) joined poll ${pollCode}`)
  })

  // Host starts the poll
  socket.on('start-poll', (data) => {
    console.log('Received start-poll event:', data)
    const { pollCode } = data
    const room = pollRooms.get(pollCode)

    console.log('Poll room found:', !!room)
    console.log('Host match:', room?.host === socket.id)
    console.log('Participants count:', room?.participants.length || 0)

    if (!room || room.host !== socket.id) {
      console.log('Error: Unauthorized or poll not found')
      socket.emit('error', { message: 'Unauthorized or poll not found' })
      return
    }

    room.status = 'active'
    room.votes = {}

    // Reset participant voting status
    room.participants.forEach(p => p.hasVoted = false)

    // Notify all participants
    io.to(pollCode).emit('poll-started', {
      status: room.status,
      poll: room.poll
    })

    // Auto-close after time limit if set
    if (room.poll.timeLimit) {
      setTimeout(() => {
        if (room.status === 'active') {
          socket.emit('close-poll', { pollCode })
        }
      }, room.poll.timeLimit * 1000)
    }

    console.log(`Poll ${pollCode} started`)
  })

  // Participant submits vote
  socket.on('submit-vote', (data) => {
    const { pollCode, participantId, selectedOptions } = data
    const room = pollRooms.get(pollCode)

    if (!room || room.status !== 'active') {
      return
    }

    // Validate vote
    if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
      return
    }

    // Check if multiple choices are allowed
    if (!room.poll.allowMultipleChoices && selectedOptions.length > 1) {
      return
    }

    // Record the vote
    room.votes[participantId] = selectedOptions

    // Update participant voting status
    const participant = room.participants.find(p => p.id === participantId)
    if (participant) {
      participant.hasVoted = true
    }

    // Calculate current results
    const stats = new Array(room.poll.options.length).fill(0)
    let totalVotes = 0

    for (const votes of Object.values(room.votes)) {
      for (const optionIndex of votes) {
        if (optionIndex >= 0 && optionIndex < stats.length) {
          stats[optionIndex]++
          totalVotes++
        }
      }
    }

    // Notify host and participants of updated results
    const results = {
      pollId: room.poll.id,
      question: room.poll.question,
      options: room.poll.options,
      stats,
      totalVotes,
      participantCount: room.participants.length,
      votedCount: Object.keys(room.votes).length,
      isAnonymous: room.poll.isAnonymous,
      votes: room.poll.isAnonymous ? {} : room.votes
    }

    io.to(pollCode).emit('poll-results-updated', results)

    console.log(`Participant ${participantId} voted in poll ${pollCode}`)
  })

  // Host closes the poll
  socket.on('close-poll', (data) => {
    const { pollCode } = data
    const room = pollRooms.get(pollCode)

    if (!room || room.host !== socket.id) {
      return
    }

    room.status = 'closed'

    // Calculate final results
    const stats = new Array(room.poll.options.length).fill(0)
    let totalVotes = 0

    for (const votes of Object.values(room.votes)) {
      for (const optionIndex of votes) {
        if (optionIndex >= 0 && optionIndex < stats.length) {
          stats[optionIndex]++
          totalVotes++
        }
      }
    }

    const finalResults = {
      pollId: room.poll.id,
      question: room.poll.question,
      options: room.poll.options,
      stats,
      totalVotes,
      participantCount: room.participants.length,
      votedCount: Object.keys(room.votes).length,
      isAnonymous: room.poll.isAnonymous,
      votes: room.poll.isAnonymous ? {} : room.votes
    }

    io.to(pollCode).emit('poll-closed', finalResults)

    console.log(`Poll ${pollCode} closed`)
  })

  // Get poll state
  socket.on('get-poll-state', (data) => {
    const { pollCode } = data
    const room = pollRooms.get(pollCode)

    if (!room) {
      socket.emit('error', { message: 'Poll not found' })
      return
    }

    socket.emit('poll-state', {
      room: {
        id: room.id,
        poll: room.host === socket.id ? room.poll : {
          question: room.poll.question,
          options: room.poll.options,
          allowMultipleChoices: room.poll.allowMultipleChoices,
          isAnonymous: room.poll.isAnonymous,
          timeLimit: room.poll.timeLimit
        },
        participants: room.participants,
        status: room.status
      }
    })
  })

  // Get game state
  socket.on('get-game-state', (data) => {
    const { gameCode } = data
    const room = gameRooms.get(gameCode)

    if (!room) {
      socket.emit('error', { message: 'Game not found' })
      return
    }

    socket.emit('game-state', {
      room: {
        id: room.id,
        quiz: room.host === socket.id ? room.quiz : {
          title: room.quiz.title,
          description: room.quiz.description
        },
        players: room.players,
        status: room.status,
        currentQuestionIndex: room.currentQuestionIndex
      }
    })
  })

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason)

    // Update connection stats
    const clientIP = socket.handshake.address
    connectionStats.activeConnections = Math.max(0, connectionStats.activeConnections - 1)
    const ipConnections = connectionStats.connectionsPerIP.get(clientIP) || 0
    if (ipConnections > 1) {
      connectionStats.connectionsPerIP.set(clientIP, ipConnections - 1)
    } else {
      connectionStats.connectionsPerIP.delete(clientIP)
    }

    // Clean up rate limiting data
    rateLimits.delete(socket.id)

    console.log(`Connection stats: ${connectionStats.activeConnections}/${connectionStats.maxConnections} active`)

    // Remove player from games and clean up
    for (const [gameCode, room] of gameRooms) {
      // If host disconnects, end the game
      if (room.host === socket.id) {
        io.to(gameCode).emit('host-disconnected')
        gameRooms.delete(gameCode)
        console.log(`Game ${gameCode} ended due to host disconnect`)
        continue
      }

      // If player disconnects, remove them from the room
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id)
      if (playerIndex !== -1) {
        const player = room.players[playerIndex]
        room.players.splice(playerIndex, 1)
        playerSockets.delete(player.id)

        io.to(gameCode).emit('player-left', {
          player,
          players: room.players,
          playerCount: room.players.length
        })

        console.log(`Player ${player.name} left game ${gameCode}`)
      }
    }

    // Remove participant from polls and clean up
    for (const [pollCode, room] of pollRooms) {
      // If host disconnects, end the poll
      if (room.host === socket.id) {
        io.to(pollCode).emit('poll-host-disconnected')
        pollRooms.delete(pollCode)
        console.log(`Poll ${pollCode} ended due to host disconnect`)
        continue
      }

      // If participant disconnects, remove them from the room
      const participantIndex = room.participants.findIndex(p => p.socketId === socket.id)
      if (participantIndex !== -1) {
        const participant = room.participants[participantIndex]
        room.participants.splice(participantIndex, 1)
        participantSockets.delete(participant.id)

        io.to(pollCode).emit('participant-left', {
          participant,
          participants: room.participants,
          participantCount: room.participants.length
        })

        console.log(`Participant ${participant.name} left poll ${pollCode}`)
      }
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`)
})
