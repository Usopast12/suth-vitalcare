import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export const initRealtime = (server: HTTPServer) => {
    // [DISABLED] Temporarily disabled to reduce lag until project is finished
    io = new SocketIOServer(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        destroyUpgrade: false, // Prevent Socket.io from dropping Vite's HMR websocket
        maxHttpBufferSize: 1e6, // 1 MB
        pingTimeout: 60000, // 60 seconds
        pingInterval: 25000, // 25 seconds
        transports: ['websocket', 'polling'] // Allow fallback
    });

    // จำกัดจำนวน connections เพื่อป้องกันการโหลดช้า
    let connectionCount = 0;
    const MAX_CONNECTIONS = 100;

    io.on('connection', (socket) => {
        connectionCount++;
        
        // ปฏิเสธ connection ถ้าเกินจำนวน
        if (connectionCount > MAX_CONNECTIONS) {
            socket.emit('error', 'Server overloaded');
            socket.disconnect();
            return;
        }

        socket.on('disconnect', () => {
            connectionCount--;
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        return { emit: () => {} };
    }
    return io;
};

export const EVENTS = {
    SUBMISSION_CREATED: 'SUBMISSION_CREATED',
    SUBMISSION_UPDATED: 'SUBMISSION_UPDATED',
    SUBMISSION_DELETED: 'SUBMISSION_DELETED',
    USER_REGISTERED: 'USER_REGISTERED',
    USER_UPDATED: 'USER_UPDATED',
    ACTIVITY_CREATED: 'ACTIVITY_CREATED',
    ACTIVITY_UPDATED: 'ACTIVITY_UPDATED',
    ACTIVITY_DELETED: 'ACTIVITY_DELETED',
    ACTIVITY_REQUEST_CREATED: 'ACTIVITY_REQUEST_CREATED',
    ACTIVITY_REQUEST_UPDATED: 'ACTIVITY_REQUEST_UPDATED',
    TEAM_CREATED: 'TEAM_CREATED',
    TEAM_UPDATED: 'TEAM_UPDATED',
    TEAM_DELETED: 'TEAM_DELETED',
    TEAM_JOINED: 'TEAM_JOINED',
    TEAM_LEFT: 'TEAM_LEFT',
    TEAM_KICKED: 'TEAM_KICKED',
    BANNER_CREATED: 'BANNER_CREATED',
    BANNER_DELETED: 'BANNER_DELETED',
    USER_KICKED: 'USER_KICKED'
};
