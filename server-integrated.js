import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { v4 as uuidv4 } from 'uuid';

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// In-memory storage (same as your current server.js)
const gameRooms = new Map();
const playerSockets = new Map();

// Utility functions (same as your current server.js)
function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function calculateScore(isCorrect, timeRemaining, totalTime) {
  if (!isCorrect) return 0;
  const baseScore = 1000;
  const timeBonus = Math.floor((timeRemaining / totalTime) * 500);
  return baseScore + timeBonus;
}

function getLeaderboard(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({
      ...player,
      rank: index + 1
    }));
}

app.prepare().then(() => {
  const httpServer = createServer(handler);
  
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? ["http://localhost:3000"] : false,
      methods: ["GET", "POST"]
    }
  });

  // All your Socket.io event handlers go here (same as your current server.js)
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Host creates a new game
    socket.on('create-game', (data) => {
      const { quiz, hostName } = data;
      const gameCode = generateGameCode();
      
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
      };
      
      gameRooms.set(gameCode, room);
      socket.join(gameCode);
      
      socket.emit('game-created', {
        gameCode,
        room
      });
      
      console.log(`Game created: ${gameCode}`);
    });

    // ... (rest of your Socket.io event handlers)
    // Copy all the event handlers from your current server.js file

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // ... (same disconnect logic as your current server.js)
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
