# 🚂 Railway Deployment Guide

## Project Details
- **Project ID**: `5f9dc8a5-eab0-42a1-b112-3d4c0ab09249`
- **Vercel Domain**: `https://quizmaster-ivory.vercel.app`
- **GitHub Repo**: `dakshinrajsiva/quizmaster-polling-app`

## ✅ Deployment Checklist

### Step 1: Environment Variables (DO THIS FIRST)
Go to: https://railway.app/project/5f9dc8a5-eab0-42a1-b112-3d4c0ab09249

Add these variables in the **Variables** tab:

```
NODE_ENV=production
CLIENT_URL=https://quizmaster-ivory.vercel.app
PORT=3001
MAX_CONNECTIONS=50
MAX_CONNECTIONS_PER_IP=5
RATE_LIMIT_WINDOW=60000
MAX_REQUESTS_PER_WINDOW=100
```

### Step 2: Monitor Deployment
1. Check the **Deployments** tab in Railway
2. Look for the latest deployment (triggered by your GitHub push)
3. Wait for build to complete (should show ✅ success)
4. Get your Railway URL (e.g., `https://your-app.railway.app`)

### Step 3: Update Vercel
Once Railway gives you the URL, add to Vercel:

```
NEXT_PUBLIC_SOCKET_URL=https://your-railway-url.railway.app
```

## 🔍 Expected Railway Build Output

```
✅ Installing dependencies with npm ci
✅ Building with npm run build  
✅ Starting with node server.js
✅ Deployment successful
```

## 🧪 Testing After Deployment

### Test Production App
1. Go to: `https://quizmaster-ivory.vercel.app`
2. Create a quiz → Should work without connection errors
3. Join quiz from another tab → Should connect in real-time
4. Create a poll → Should work with live results

### Check Browser Console
Should see:
```
✅ Socket.io client connected successfully
✅ Transport: websocket (or polling)
```

## 🚨 Troubleshooting

### If Railway Build Fails
- Check **Logs** tab in Railway dashboard
- Ensure all environment variables are set
- Verify GitHub repo is connected

### If Frontend Can't Connect
- Verify `NEXT_PUBLIC_SOCKET_URL` in Vercel matches Railway URL
- Check Railway service is running (not sleeping)
- Verify CORS settings in server.js include your Vercel domain

### If Real-time Features Don't Work
- Check browser console for Socket.io errors
- Verify Railway deployment is using correct port (3001)
- Test with multiple browser tabs

## 📊 Expected Performance
- **Connection Time**: < 2 seconds
- **Real-time Updates**: < 100ms latency  
- **Concurrent Users**: Up to 50 (as configured)
- **Transport**: WebSocket with polling fallback

---

**Next Step**: After Railway deployment completes, update Vercel with the Railway URL!
