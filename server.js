const { createServer } = require('http')
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid')

console.log('Socket.io server starting...')

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.CLIENT_URL || 'https://your-app.vercel.app'] 
      : ['http://localhost:3000', 'http://localhost:3002'],
    methods: ['GET', 'POST'],
    credentials: true
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
  maxConnections: 50, // Limit for 30+ users with some buffer
  connectionsPerIP: new Map(),
  maxConnectionsPerIP: 5
}

// Rate limiting
const rateLimits = new Map() // socketId -> { requests: [], lastReset: timestamp }
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100 // Max requests per minute per connection

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
    const { gameCode, playerName } = data
    const room = gameRooms.get(gameCode)
    
    if (!room) {
      socket.emit('join-error', { message: 'Game not found' })
      return
    }
    
    if (room.status !== 'waiting') {
      socket.emit('join-error', { message: 'Game has already started' })
      return
    }
    
    // Check if player name already exists
    if (room.players.some(p => p.name === playerName)) {
      socket.emit('join-error', { message: 'Player name already taken' })
      return
    }
    
    const player = {
      id: uuidv4(),
      name: playerName,
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
    
    console.log(`Player ${playerName} joined game ${gameCode}`)
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

  // POLLING SYSTEM EVENTS

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
    const { pollCode, participantName } = data
    const room = pollRooms.get(pollCode)
    
    if (!room) {
      socket.emit('poll-join-error', { message: 'Poll not found' })
      return
    }
    
    // Check if participant name already exists
    if (room.participants.some(p => p.name === participantName)) {
      socket.emit('poll-join-error', { message: 'Name already taken' })
      return
    }
    
    const participant = {
      id: uuidv4(),
      name: participantName,
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
    
    console.log(`Participant ${participantName} joined poll ${pollCode}`)
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
