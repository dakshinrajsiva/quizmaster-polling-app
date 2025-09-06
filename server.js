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
    'https://quizmaster-m7kfsy8zr-dakshin-raj-sivas-projects.vercel.app',
    'https://quizmaster-qshcc6j6s-dakshin-raj-sivas-projects.vercel.app',
    'https://quizmaster-4e7es6u1f-dakshin-raj-sivas-projects.vercel.app',
    'https://quizmaster-p8u3h6ed7-dakshin-raj-sivas-projects.vercel.app'
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
const rateLimits = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 500 // Increased for testing - was 100

// BROADCAST POLLING SYSTEM GLOBAL STATE
let globalPoll = null
let globalPollParticipants = new Map()
let globalPollVotes = {}
let globalPollTimer = null

// Debug function to log globalPoll state
function logGlobalPollState(context) {
  console.log(`🔍 [${context}] GlobalPoll State:`)
  console.log(`   - Exists: ${!!globalPoll}`)
  console.log(`   - Status: ${globalPoll?.status}`)
  console.log(`   - Question: ${globalPoll?.question}`)
  console.log(`   - Host: ${globalPoll?.host}`)
  console.log(`   - Participants: ${globalPollParticipants.size}`)
  console.log(`   - Timer: ${!!globalPollTimer}`)
}

// Function to auto-close poll when time limit expires
function autoClosePoll() {
  if (!globalPoll || globalPoll.status !== 'active') {
    return
  }
  
  console.log('⏰ Poll time limit reached, auto-closing poll:', globalPoll.question)
  
  globalPoll.status = 'closed'
  
  const totalVotes = Object.values(globalPollVotes).reduce((sum, count) => sum + count, 0)
  const finalResults = {
    question: globalPoll.question,
    options: globalPoll.options,
    stats: globalPoll.options.map((_, index) => globalPollVotes[index] || 0),
    totalVotes,
    participantCount: globalPollParticipants.size
  }
  
  // Broadcast poll closed to everyone
  io.emit('poll-broadcast-closed', finalResults)
  
  console.log(`⏰ Poll "${globalPoll.question}" auto-closed due to time limit`)
  
  // Clear timer
  if (globalPollTimer) {
    clearTimeout(globalPollTimer)
    globalPollTimer = null
  }
  
  // Reset global poll after a delay
  setTimeout(() => {
    console.log('🧹 CLEARING GlobalPoll after auto-close')
    globalPoll = null
    globalPollParticipants.clear()
    globalPollVotes = {}
  }, 30000) // Increased to 30 seconds
}

// Connection validation
function validateConnection(socket) {
  const clientIP = socket.handshake.address
  
  // Check total connections
  if (connectionStats.activeConnections >= connectionStats.maxConnections) {
    socket.emit('connection-error', { message: 'Server is at maximum capacity. Please try again later.' })
    socket.disconnect(true)
    return false
  }
  
  // Check connections per IP
  const ipConnections = connectionStats.connectionsPerIP.get(clientIP) || 0
  if (ipConnections >= connectionStats.maxConnectionsPerIP) {
    socket.emit('connection-error', { message: 'Too many connections from your IP. Please try again later.' })
    socket.disconnect(true)
    return false
  }
  
  return true
}

// Rate limiting
function checkRateLimit(socket) {
  const now = Date.now()
  const socketRateData = rateLimits.get(socket.id) || { count: 0, window: now }
  
  // Reset window if expired
  if (now - socketRateData.window > RATE_LIMIT_WINDOW) {
    socketRateData.count = 0
    socketRateData.window = now
  }
  
  socketRateData.count++
  rateLimits.set(socket.id, socketRateData)
  
  if (socketRateData.count > MAX_REQUESTS_PER_WINDOW) {
    socket.emit('rate-limit-error', { message: 'Too many requests. Please slow down.' })
    return false
  }
  
  return true
}

// Helper function to generate unique room codes
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
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

  // BROADCAST POLLING SYSTEM EVENTS
  
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
    
    console.log('🔄 GlobalPoll CREATED and stored in memory')
    logGlobalPollState('AFTER CREATE')
    
    // Reset votes
    globalPollVotes = {}
    poll.options.forEach((_, index) => {
      globalPollVotes[index] = 0
    })
    
    console.log('✅ Broadcast poll created:', globalPoll.question)
    console.log('🎮 Host socket ID:', socket.id)
    console.log('📊 Poll options:', globalPoll.options)
    
    socket.emit('broadcast-poll-created', { poll: globalPoll })
  })

  // Host launches the broadcast poll
  socket.on('launch-broadcast-poll', (data) => {
    console.log('🚀 Launch broadcast poll requested by:', socket.id)
    
    if (!globalPoll || globalPoll.host !== socket.id) {
      console.log('❌ Launch denied - No poll or not authorized')
      socket.emit('error', { message: 'No poll to launch or not authorized' })
      return
    }
    
    globalPoll.status = 'active'
    globalPoll.startedAt = new Date()
    globalPollParticipants.clear()
    
    // Clear any existing timer
    if (globalPollTimer) {
      clearTimeout(globalPollTimer)
      globalPollTimer = null
    }
    
    // Set up auto-close timer if poll has time limit
    if (globalPoll.timeLimit && globalPoll.timeLimit > 0) {
      console.log(`⏰ Setting poll timer for ${globalPoll.timeLimit} seconds`)
      globalPollTimer = setTimeout(autoClosePoll, globalPoll.timeLimit * 1000)
    }
    
    logGlobalPollState('AFTER LAUNCH')
    
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
    logGlobalPollState('GET-CURRENT-POLL')
    
    if (globalPoll && globalPoll.status === 'active') {
      console.log('📋 Sending current poll:', globalPoll.question)
      socket.emit('current-poll-response', { poll: globalPoll })
    } else {
      console.log('📋 No active poll to send - Poll exists:', !!globalPoll, 'Status:', globalPoll?.status)
      socket.emit('current-poll-response', { poll: null })
    }
  })

  // User joins the broadcast poll
  socket.on('join-broadcast-poll', () => {
    console.log('🤝 JOIN-BROADCAST-POLL requested by:', socket.id)
    logGlobalPollState('BEFORE JOIN')
    
    if (!globalPoll || globalPoll.status !== 'active') {
      console.log('❌ JOIN REJECTED: No active poll')
      socket.emit('poll-join-error', { message: 'No active poll' })
      return
    }
    
    // Check if already joined
    if (globalPollParticipants.has(socket.id)) {
      console.log('❌ JOIN REJECTED: Already joined')
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
    
    console.log('✅ JOIN SUCCESS:', participant.name)
    console.log('👥 Total participants:', globalPollParticipants.size)
    
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
    
    console.log('🗳️ VOTE SUBMISSION from:', socket.id)
    console.log('🗳️ Selected options:', selectedOptions)
    logGlobalPollState('VOTE SUBMISSION')
    
    if (!globalPoll || globalPoll.status !== 'active') {
      console.log('❌ VOTE REJECTED: No active poll - Poll exists:', !!globalPoll, 'Status:', globalPoll?.status)
      socket.emit('vote-error', { message: 'No active poll' })
      return
    }
    
    const participant = globalPollParticipants.get(socket.id)
    if (!participant) {
      console.log('❌ VOTE REJECTED: Not joined in poll')
      socket.emit('vote-error', { message: 'Not joined in poll' })
      return
    }
    
    if (participant.hasVoted) {
      console.log('❌ VOTE REJECTED: Already voted')
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
    
    console.log('✅ VOTE ACCEPTED from:', participant.name)
    
    // Calculate results
    const totalVotes = Object.values(globalPollVotes).reduce((sum, count) => sum + count, 0)
    const results = {
      question: globalPoll.question,
      options: globalPoll.options,
      stats: globalPoll.options.map((_, index) => globalPollVotes[index] || 0),
      totalVotes,
      participantCount: globalPollParticipants.size
    }
    
    // Send confirmation to voter
    socket.emit('vote-submitted', { results })
    
    // Broadcast updated results to everyone
    io.emit('poll-results-updated', results)
    
    console.log(`Vote submitted by ${participant.name}`)
  })
  
  // Host closes the broadcast poll
  socket.on('close-broadcast-poll', () => {
    console.log('🛑 CLOSE-BROADCAST-POLL event received from:', socket.id)
    logGlobalPollState('BEFORE CLOSE')
    
    if (!globalPoll || globalPoll.host !== socket.id) {
      console.log('🛑 DENIED: Not authorized to close poll')
      socket.emit('error', { message: 'Not authorized to close poll' })
      return
    }
    
    // Check if poll was just launched (prevent accidental immediate closure)
    const timeSinceLaunch = new Date() - new Date(globalPoll.startedAt || globalPoll.createdAt)
    if (timeSinceLaunch < 10000) { // Less than 10 seconds
      console.log('⚠️ WARNING: Poll closed very quickly after launch (', timeSinceLaunch, 'ms)')
    }
    
    console.log('🛑 PROCEEDING: Closing broadcast poll')
    
    globalPoll.status = 'closed'
    
    // Clear the timer if it exists
    if (globalPollTimer) {
      clearTimeout(globalPollTimer)
      globalPollTimer = null
      console.log('⏰ Cleared poll timer')
    }
    
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
    
    // Reset global poll after a longer delay to allow final result viewing
    setTimeout(() => {
      console.log('🧹 CLEARING GlobalPoll after poll closed')
      globalPoll = null
      globalPollParticipants.clear()
      globalPollVotes = {}
    }, 30000) // Increased to 30 seconds
  })

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason)
    
    // Check if this was the globalPoll host
    if (globalPoll && globalPoll.host === socket.id) {
      console.log('🚨 WARNING: GlobalPoll host disconnected! Keeping poll active for participants.')
      // Don't clear globalPoll - let participants still join and vote
    }

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

    // Remove participant from global poll if they were part of it
    if (globalPollParticipants.has(socket.id)) {
      const participant = globalPollParticipants.get(socket.id)
      globalPollParticipants.delete(socket.id)
      console.log(`Removed ${participant.name} from global poll`)
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`)
})
