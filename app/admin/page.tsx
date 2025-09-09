'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, BarChart3, Trophy, Users, Eye, Settings, Lock } from 'lucide-react'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function AdminDashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Simple password protection (in production, use proper authentication)
  const ADMIN_PASSWORD = 'admin123' // Change this to a secure password

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setError('')
      localStorage.setItem('adminAuth', 'true')
    } else {
      setError('Invalid password')
    }
  }

  // Check if already authenticated
  useEffect(() => {
    const authStatus = localStorage.getItem('adminAuth')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('adminAuth')
    setPassword('')
  }

  const handleCreateQuiz = () => {
    router.push('/host')
  }

  const handleCreatePoll = () => {
    router.push('/poll')
  }

  const handleViewPublic = () => {
    router.push('/')
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full">
          <div className="card">
            <div className="text-center mb-6">
              <div className="bg-red-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Access</h1>
              <p className="text-gray-600">Enter password to access admin dashboard</p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="input-field w-full"
              />
              {error && (
                <p className="text-red-600 text-sm text-center">{error}</p>
              )}
              <button
                onClick={handleLogin}
                className="btn-primary w-full"
              >
                <Lock className="w-4 h-4 mr-2 inline" />
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Admin dashboard
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header with logos and logout */}
      <header className="w-full p-4 bg-white shadow-sm">
        <div className="flex justify-between items-center">
          {/* HCL Logo - Top Left */}
          <div className="flex items-center">
            <Image
              src="/hcl.png"
              alt="HCL Logo"
              width={120}
              height={60}
              className="h-12 w-auto"
              priority
            />
          </div>
          
          {/* Admin Badge */}
          <div className="flex items-center space-x-4">
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              <Settings className="w-4 h-4 inline mr-1" />
              Admin Dashboard
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Logout
            </button>
          </div>

          {/* BM Logo - Top Right */}
          <div className="flex items-center">
            <Image
              src="/bm_logo_color.png"
              alt="BM Logo"
              width={120}
              height={60}
              className="h-12 w-auto"
              priority
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Create and manage polls, quizzes, and view results</p>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Create Poll */}
            <div className="card animate-slide-up hover:shadow-lg transition-shadow">
              <div className="text-center mb-4">
                <div className="bg-blue-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Create Poll</h2>
                <p className="text-gray-600 text-sm">Launch real-time polls for instant feedback</p>
              </div>
              
              <button
                onClick={handleCreatePoll}
                className="btn-primary w-full"
              >
                <Plus className="w-4 h-4 mr-2 inline" />
                New Poll
              </button>
            </div>

            {/* Create Quiz */}
            <div className="card animate-slide-up hover:shadow-lg transition-shadow">
              <div className="text-center mb-4">
                <div className="bg-yellow-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Create Quiz</h2>
                <p className="text-gray-600 text-sm">Host competitive quizzes with scoring</p>
              </div>
              
              <button
                onClick={handleCreateQuiz}
                className="btn-warning w-full"
              >
                <Plus className="w-4 h-4 mr-2 inline" />
                New Quiz
              </button>
            </div>

            {/* View Public Interface */}
            <div className="card animate-slide-up hover:shadow-lg transition-shadow">
              <div className="text-center mb-4">
                <div className="bg-green-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Eye className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Public View</h2>
                <p className="text-gray-600 text-sm">See what participants see</p>
              </div>
              
              <button
                onClick={handleViewPublic}
                className="btn-success w-full"
              >
                <Eye className="w-4 h-4 mr-2 inline" />
                View Public
              </button>
            </div>

            {/* Statistics */}
            <div className="card animate-slide-up">
              <div className="text-center mb-4">
                <div className="bg-purple-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Statistics</h2>
                <p className="text-gray-600 text-sm">View usage and results</p>
              </div>
              
              <div className="space-y-2 text-center">
                <p className="text-2xl font-bold text-purple-600">0</p>
                <p className="text-sm text-gray-500">Active Sessions</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Recent Activity</h2>
              <span className="text-sm text-gray-500">Last 24 hours</span>
            </div>
            
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
              <p className="text-sm">Create your first poll or quiz to get started</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
