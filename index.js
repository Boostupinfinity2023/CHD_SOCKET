const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['polling', 'websocket'],
});

const onlineUsers = {};          // { userId: socketId }
const pendingMessages = {};      // { userId: [messages...] }

io.on('connection', (socket) => {
    console.log(`📡 Socket connected: ${socket.id}`);

    // User registers on socket
    socket.on('register_user', (userId) => {
        onlineUsers[userId] = socket.id;
        console.log(`✅ User ${userId} registered`);

        // Send pending messages if any
        if (pendingMessages[userId]) {
            for (const msg of pendingMessages[userId]) {
                io.to(socket.id).emit('user_channel_' + userId, msg);
            }
            delete pendingMessages[userId];
        }
    });

    socket.on('disconnect', () => {
        for (const [userId, sockId] of Object.entries(onlineUsers)) {
            if (sockId === socket.id) {
                delete onlineUsers[userId];
                console.log(`❌ User ${userId} disconnected`);
                break;
            }
        }
    });
});

// API to receive PHP push request
app.post('/emit', (req, res) => {
    const { user_ids, painting_id, painting_title, message } = req.body;

    for (const userId of user_ids) {
        const payload = { painting_id, painting_title, message };

        const socketId = onlineUsers[userId];
        if (socketId) {
            io.to(socketId).emit('user_channel_' + userId, payload);
        } else {
            // Save to pending if user is offline
            if (!pendingMessages[userId]) pendingMessages[userId] = [];
            pendingMessages[userId].push(payload);
        }
    }

    res.json({ success: true });
});

server.listen(3000, () => {
    console.log('🚀 Socket.IO + API server on port 3000');
});
