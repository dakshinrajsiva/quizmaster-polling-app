# QuizMaster - Interactive Quiz App

A real-time interactive quiz application similar to Kahoot, built with Next.js, TypeScript, and Socket.io.

## Features

- 🎯 **Real-time Multiplayer**: Join games with unique codes and compete with unlimited players
- 🎨 **Modern UI**: Beautiful, responsive design with smooth animations
- ⚡ **Live Updates**: Real-time question display, answer submission, and scoring
- 🏆 **Leaderboard**: Track scores and rankings throughout the game
- 📊 **Results Analysis**: View answer statistics and correct answers after each question
- 🎮 **Host Controls**: Full game management with question creation and flow control

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Socket.io, Node.js
- **Real-time Communication**: WebSockets
- **Icons**: Lucide React
- **Styling**: Tailwind CSS with custom animations

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd SecurityQuestion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development servers**
   ```bash
   # Start both the Socket.io server and Next.js app
   npm run dev:all
   
   # Or start them separately:
   # Terminal 1: Start the Socket.io server
   npm run server
   
   # Terminal 2: Start the Next.js app
   npm run dev
   ```

4. **Open your browser**
   - Frontend: http://localhost:3000
   - Socket.io server: http://localhost:3001

## How to Use

### For Hosts (Quiz Creators)

1. **Create a Quiz**
   - Go to the homepage and click "Create Game"
   - Add quiz title and description
   - Add questions with 4 multiple-choice options each
   - Set time limits for each question (10-60 seconds)
   - Mark the correct answer for each question

2. **Start the Game**
   - Click "Create Game" to generate a unique 6-character game code
   - Share the game code with participants
   - Wait for players to join
   - Click "Start Game" when ready

3. **Manage the Game**
   - Monitor player answers in real-time
   - End questions early if needed
   - View answer statistics after each question
   - Advance to the next question
   - View final leaderboard

### For Players (Participants)

1. **Join a Game**
   - Go to the homepage
   - Enter the 6-character game code
   - Enter your name to join

2. **Play the Game**
   - Wait for the host to start the game
   - Read each question carefully
   - Select your answer before time runs out
   - View results and your ranking after each question
   - See your final score and position

## Game Flow

```
1. Host creates quiz → Game code generated
2. Players join using game code
3. Host starts the game
4. For each question:
   - Question displayed to all players
   - Players submit answers within time limit
   - Results shown with correct answer and statistics
   - Leaderboard updated
   - Host advances to next question
5. Final leaderboard and game complete
```

## Project Structure

```
SecurityQuestion/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles and Tailwind classes
│   ├── layout.tsx         # Root layout component
│   ├── page.tsx           # Homepage (join/create game)
│   ├── host/              # Host-related pages
│   │   ├── page.tsx       # Quiz creation interface
│   │   └── [gameCode]/    # Game management interface
│   └── play/              # Player-related pages
│       └── [gameCode]/    # Player game interface
├── lib/                   # Utility functions and configurations
│   ├── socket.ts          # Socket.io client configuration
│   └── utils.ts           # Helper functions
├── types/                 # TypeScript type definitions
│   └── quiz.ts            # Quiz-related types
├── server.js              # Socket.io server
└── package.json           # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run server` - Start Socket.io server
- `npm run dev:all` - Start both servers concurrently
- `npm run build` - Build the Next.js application
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

## Customization

### Adding New Question Types
Modify the `Question` interface in `types/quiz.ts` and update the UI components accordingly.

### Changing Scoring System
Update the `calculateScore` function in `lib/utils.ts` and `server.js`.

### Styling
Customize colors and animations in `tailwind.config.js` and `app/globals.css`.

## Deployment

### Frontend (Next.js)
Deploy to Vercel, Netlify, or any platform supporting Next.js.

### Backend (Socket.io)
Deploy the `server.js` to platforms like:
- Railway
- Render
- Heroku
- DigitalOcean

Update the `NEXT_PUBLIC_SOCKET_URL` environment variable to point to your deployed Socket.io server.

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

For production, update this to your deployed Socket.io server URL.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for learning and development!

## Support

If you encounter any issues or have questions, please create an issue in the repository.

---

Enjoy creating and playing interactive quizzes! 🎉
