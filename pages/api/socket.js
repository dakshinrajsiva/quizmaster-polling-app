import { Server } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'

let globalPoll = null
let globalPollParticipants = new Map()
let globalPollVotes = {}

const connectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  maxConnections: 200,
  connectionsPerIP: new Map(),
  maxConnectionsPerIP: 50
}

export default function handler(req, res) {
  if (res.socket.server.io) {
    console.log('Socket.io already running')
  } else {
    console.log('Starting Socket.io server for Vercel...')
    
    const io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true
    })

    res.socket.server.io = io

    io.on('connection', (socket) => {
      console.log('User connected:', socket.id)
      connectionStats.activeConnections++
      
      // BROADCAST POLLING SYSTEM EVENTS
      socket.on('create-broadcast-poll', (data) => {
        console.log('🎯 Received create-broadcast-poll event:', data)
        
        globalPoll = {
          ...data.poll,
          host: socket.id,
          status: 'created',
          participants: [],
          votes: {}
        }
        
        globalPollParticipants.clear()
        globalPollVotes = {}
        
        console.log('✅ Broadcast poll created:', globalPoll.question)
        socket.emit('broadcast-poll-created', { poll: globalPoll })
      })

      socket.on('launch-broadcast-poll', (data) => {
        console.log('🚀 Launch broadcast poll requested by:', socket.id)
        
        if (!globalPoll || globalPoll.host !== socket.id) {
          console.log('❌ Launch denied - No poll or not authorized')
          socket.emit('error', { message: 'No poll to launch or not authorized' })
          return
        }
        
        globalPoll.status = 'active'
        globalPollParticipants.clear()
        
        console.log('📡 Broadcasting poll to ALL connected users:', globalPoll.question)
        
        // Broadcast to ALL connected users
        io.emit('poll-broadcast', {
          poll: globalPoll
        })
        
        console.log(`✅ Poll "${globalPoll.question}" launched globally`)
      })

      socket.on('join-broadcast-poll', () => {
        if (!globalPoll || globalPoll.status !== 'active') {
          socket.emit('poll-join-error', { message: 'No active poll to join' })
          return
        }

        if (globalPollParticipants.has(socket.id)) {
          socket.emit('poll-join-error', { message: 'Already joined this poll' })
          return
        }

        const participant = {
          id: uuidv4(),
          name: `Participant ${globalPollParticipants.size + 1}`,
          socketId: socket.id,
          joinedAt: new Date()
        }

        globalPollParticipants.set(socket.id, participant)

        socket.emit('poll-join-success', {
          participant,
          poll: globalPoll,
          participantCount: globalPollParticipants.size
        })

        console.log(`✅ Participant ${participant.name} joined broadcast poll`)
      })

      socket.on('submit-broadcast-vote', (data) => {
        if (!globalPoll || globalPoll.status !== 'active') {
          socket.emit('vote-error', { message: 'No active poll' })
          return
        }

        if (!globalPollParticipants.has(socket.id)) {
          socket.emit('vote-error', { message: 'Not joined to poll' })
          return
        }

        const { selectedOptions } = data

        // Record votes
        selectedOptions.forEach(optionIndex => {
          globalPollVotes[optionIndex] = (globalPollVotes[optionIndex] || 0) + 1
        })

        const totalVotes = Object.values(globalPollVotes).reduce((sum, count) => sum + count, 0)
        const results = {
          question: globalPoll.question,
          options: globalPoll.options,
          stats: globalPoll.options.map((_, index) => globalPollVotes[index] || 0),
          totalVotes,
          participantCount: globalPollParticipants.size
        }

        socket.emit('vote-submitted', { results })
        io.emit('poll-results-updated', results)

        console.log(`📊 Vote submitted by ${socket.id}:`, selectedOptions)
      })

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
        
        // Reset global poll after a delay
        setTimeout(() => {
          globalPoll = null
          globalPollParticipants.clear()
          globalPollVotes = {}
        }, 5000)
      })

      socket.on('disconnect', (reason) => {
        console.log('User disconnected:', socket.id, 'Reason:', reason)
        connectionStats.activeConnections--
        
        // Remove from global poll if participant
        if (globalPollParticipants.has(socket.id)) {
          globalPollParticipants.delete(socket.id)
        }
      })
    })
  }
  
  res.end()
}
