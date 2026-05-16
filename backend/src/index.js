import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'

const app = new Hono()

// Apply CORS to all routes
app.use('/*', cors({
  origin: '*', // Allow all origins for dev, restrict in production
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

app.get('/', (c) => {
  return c.text('Cloudflare Calls Backend API is running!')
})

// Hash password helper using WebCrypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// MongoDB Atlas Data API Helper
const callMongoAPI = async (env, action, collection, payload = {}) => {
  const API_URL = env.MONGODB_DATA_API_URL;
  const API_KEY = env.MONGODB_API_KEY;
  const CLUSTER_NAME = env.MONGODB_CLUSTER_NAME;

  if (!API_URL || !API_KEY) {
    return { success: true, action, collection, data: payload, isMock: true };
  }

  const data = JSON.stringify({
    collection: collection,
    database: "call_team_db",
    dataSource: CLUSTER_NAME || "Cluster0",
    ...payload
  });

  const response = await fetch(`${API_URL}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
      'api-key': API_KEY,
    },
    body: data
  });

  return await response.json();
}

// Logger Helper
const logEvent = async (env, action, email, details = '') => {
  const logData = {
    action,
    email,
    details,
    timestamp: new Date().toISOString()
  };
  await callMongoAPI(env, 'insertOne', 'logs', { document: logData });
};

// ---------------- MIDDLEWARE ----------------

const requireAuth = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Chưa xác thực token' }, 401);
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET || 'secret');
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ error: 'Token không hợp lệ hoặc đã hết hạn' }, 401);
  }
};

const adminAuth = async (c, next) => {
  await requireAuth(c, async () => {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return c.json({ error: 'Truy cập bị từ chối: Chỉ dành cho Admin' }, 403);
    }
    await next();
  });
};

// ---------------- AUTH API ----------------

app.post('/api/auth/register', async (c) => {
  const { email, password, name } = await c.req.json();
  if (!email || !password || !name) return c.json({ error: 'Vui lòng điền đủ thông tin' }, 400);

  const existing = await callMongoAPI(c.env, 'findOne', 'users', { filter: { email } });
  if (!existing.isMock && existing.document) {
    return c.json({ error: 'Email đã tồn tại' }, 400);
  }

  const hashedPassword = await hashPassword(password);
  
  const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';

  const user = {
    id: crypto.randomUUID(),
    email,
    name,
    password: hashedPassword,
    role,
    createdAt: new Date().toISOString()
  };

  await callMongoAPI(c.env, 'insertOne', 'users', { document: user });
  await logEvent(c.env, 'REGISTER', email, `Người dùng mới đăng ký: ${name}`);

  return c.json({ success: true, message: 'Đăng ký thành công' });
});

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'Vui lòng nhập email và mật khẩu' }, 400);

  const hashedPassword = await hashPassword(password);

  const response = await callMongoAPI(c.env, 'findOne', 'users', { filter: { email, password: hashedPassword } });

  if (response.isMock) {
    const mockRole = email.includes('admin') ? 'admin' : 'user';
    const token = await sign({ id: 'mock-id', role: mockRole, exp: Math.floor(Date.now() / 1000) + 86400 }, c.env.JWT_SECRET || 'secret');
    return c.json({ success: true, token, user: { name: 'Mock User', email, role: mockRole } });
  }

  const user = response.document;
  if (!user) {
    return c.json({ error: 'Email hoặc mật khẩu không chính xác' }, 401);
  }

  const token = await sign({
    id: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  }, c.env.JWT_SECRET || 'secret');

  await logEvent(c.env, 'LOGIN', email, `Đăng nhập thành công`);

  return c.json({
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl }
  });
});

// ---------------- ADMIN API ----------------

app.get('/api/admin/users', adminAuth, async (c) => {
  const response = await callMongoAPI(c.env, 'find', 'users', { projection: { password: 0 } });
  if (response.isMock) {
    return c.json({ success: true, users: [
      { id: '1', name: 'Mock Admin', email: 'admin@example.com', role: 'admin', createdAt: new Date().toISOString() }
    ]});
  }
  return c.json({ success: true, users: response.documents || [] });
});

app.get('/api/admin/rooms', adminAuth, async (c) => {
  const response = await callMongoAPI(c.env, 'find', 'rooms');
  return c.json({ success: true, rooms: response.isMock ? [] : (response.documents || []) });
});

app.get('/api/admin/logs', adminAuth, async (c) => {
  const response = await callMongoAPI(c.env, 'find', 'logs', { sort: { timestamp: -1 }, limit: 100 });
  return c.json({ success: true, logs: response.isMock ? [] : (response.documents || []) });
});

// ---------------- USER API (Nhóm/Phòng & Cập nhật Profile) ----------------

app.get('/api/user/rooms', requireAuth, async (c) => {
  const user = c.get('user');
  const response = await callMongoAPI(c.env, 'find', 'rooms', { filter: { "members.id": user.id } });
  return c.json({ success: true, rooms: response.isMock ? [] : (response.documents || []) });
});

app.put('/api/user/profile', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { newName, oldPassword, newPassword } = body;
  
  if (!newName && !newPassword) return c.json({ error: 'Không có dữ liệu cập nhật' }, 400);

  const userResponse = await callMongoAPI(c.env, 'findOne', 'users', { filter: { id: user.id } });
  if (userResponse.isMock || !userResponse.document) {
    return c.json({ error: 'Không tìm thấy người dùng' }, 404);
  }
  const dbUser = userResponse.document;

  const updates = {};
  let actionLog = '';

  if (newName && newName !== dbUser.name) {
    updates.name = newName;
    actionLog = 'UPDATE_PROFILE_NAME';
  }

  if (newPassword) {
    if (!oldPassword) return c.json({ error: 'Vui lòng nhập mật khẩu cũ' }, 400);
    const oldHashed = await hashPassword(oldPassword);
    if (dbUser.password !== oldHashed) {
      return c.json({ error: 'Mật khẩu cũ không chính xác' }, 400);
    }
    updates.password = await hashPassword(newPassword);
    actionLog = actionLog ? 'UPDATE_PROFILE_ALL' : 'UPDATE_PASSWORD';
  }

  if (Object.keys(updates).length > 0) {
    await callMongoAPI(c.env, 'updateOne', 'users', {
      filter: { id: user.id },
      update: { $set: updates }
    });
    await logEvent(c.env, actionLog, dbUser.email, 'Người dùng cập nhật thông tin cá nhân');
  }

  // Update JWT if name changes? JWT only stores ID and Role. Name is returned in /auth/login.
  // We can just return the new name to the client.
  return c.json({ success: true, message: 'Cập nhật thành công', name: updates.name || dbUser.name });
});

app.post('/api/user/avatar', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.parseBody();
  const file = body['avatar'];
  
  if (!file || typeof file === 'string') return c.json({ error: 'Không tìm thấy file ảnh hợp lệ' }, 400);
  
  const imgbbKey = c.env.IMGBB_API_KEY;
  if (!imgbbKey || imgbbKey.includes('VUI_LONG_NHAP')) {
    return c.json({ error: 'Chưa cấu hình API Key cho ImgBB trên Server' }, 500);
  }

  try {
    // Convert File to Base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    // Xử lý tối ưu để chuyển Uint8Array sang chuỗi binary mà không bị lỗi RangeError với file lớn
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64String = btoa(binary);

    // Post to ImgBB
    const formData = new FormData();
    formData.append('key', imgbbKey);
    formData.append('image', base64String);
    formData.append('name', `${user.id.substring(0,8)}-${Date.now()}`);

    const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });
    const imgbbData = await imgbbRes.json();

    if (!imgbbData.success) {
      return c.json({ error: 'Lỗi từ ImgBB: ' + (imgbbData.error?.message || 'Không xác định') }, 500);
    }

    const avatarUrl = imgbbData.data.url;
    
    // Cập nhật URL vào DB
    await callMongoAPI(c.env, 'updateOne', 'users', {
      filter: { id: user.id },
      update: { $set: { avatarUrl } }
    });
    
    await logEvent(c.env, 'UPDATE_AVATAR', user.email, 'Người dùng đã tải ảnh đại diện mới qua ImgBB');
    
    return c.json({ success: true, avatarUrl });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Lỗi kết nối máy chủ ImgBB' }, 500);
  }
});

// ---------------- ROOMS & WEBSOCKETS (DURABLE OBJECTS) ----------------

app.post('/api/rooms', requireAuth, async (c) => {
  const body = await c.req.json()
  const { roomName, hostId, hostName } = body
  if (!hostId) return c.json({ error: 'hostId is required' }, 400)
  
  const id = c.env.ROOM_SESSION.newUniqueId()
  const roomId = id.toString()
  
  const roomData = { 
    roomId, 
    roomName: roomName || 'Phòng mới', 
    hostId, 
    createdBy: hostName, 
    createdAt: new Date().toISOString(),
    members: [{ id: hostId, name: hostName }] // Chủ phòng là thành viên mặc định
  }
  
  await callMongoAPI(c.env, 'insertOne', 'rooms', { document: roomData })
  
  const user = c.get('user');
  // Log the email if available in payload, otherwise hostName
  await logEvent(c.env, 'CREATE_ROOM', user.email || hostName, `Tạo phòng: ${roomId}`);
  
  const stub = c.env.ROOM_SESSION.get(id)
  await stub.fetch(new Request('http://internal/init', {
    method: 'POST',
    body: JSON.stringify({ hostId, roomName: roomData.roomName }),
    headers: { 'Content-Type': 'application/json' }
  }))

  return c.json({ success: true, room: roomData })
})

app.post('/api/rooms/:roomId/join', requireAuth, async (c) => {
  const roomId = c.req.param('roomId');
  const user = c.get('user');
  const { userName } = await c.req.json();
  
  await callMongoAPI(c.env, 'updateOne', 'rooms', {
    filter: { roomId },
    update: { $addToSet: { members: { id: user.id, name: userName } } }
  });
  
  return c.json({ success: true });
});

app.post('/api/rooms/:roomId/leave', requireAuth, async (c) => {
  const roomId = c.req.param('roomId');
  const user = c.get('user');
  
  await callMongoAPI(c.env, 'updateOne', 'rooms', {
    filter: { roomId },
    update: { $pull: { members: { id: user.id } } }
  });
  
  return c.json({ success: true });
});

app.get('/api/rooms/:roomId', async (c) => {
  const roomId = c.req.param('roomId')
  try {
    const id = c.env.ROOM_SESSION.idFromString(roomId)
    const stub = c.env.ROOM_SESSION.get(id)
    const res = await stub.fetch(new Request('http://internal/info'))
    const data = await res.json()
    return c.json({ success: true, room: { roomId, ...data } })
  } catch (err) {
    return c.json({ error: 'Mã phòng không hợp lệ hoặc phòng đã đóng' }, 404)
  }
})

app.get('/api/ws/:roomId', async (c) => {
  const roomId = c.req.param('roomId')
  try {
    const id = c.env.ROOM_SESSION.idFromString(roomId)
    const stub = c.env.ROOM_SESSION.get(id)
    return stub.fetch(c.req.raw)
  } catch (err) {
    return c.text('Invalid Room ID', 400)
  }
})

// ----- DURABLE OBJECT CLASS -----
export class RoomSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.roomName = 'Phòng Mới';
    this.hostId = null;
    this.messages = []; // Lưu trữ chat tạm thời trong RAM
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/init') {
      const data = await request.json();
      this.hostId = data.hostId;
      this.roomName = data.roomName;
      return new Response(JSON.stringify({ success: true }));
    }

    if (request.method === 'GET' && url.pathname === '/info') {
      return new Response(JSON.stringify({
        roomName: this.roomName,
        hostId: this.hostId,
        participants: Array.from(this.sessions.values())
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      const userId = url.searchParams.get('userId');
      const userName = url.searchParams.get('userName');

      if (!userId || !userName) {
        return new Response("Missing user info", { status: 400 });
      }

      if (!this.hostId) {
        this.hostId = userId;
      }

      const { 0: client, 1: server } = new WebSocketPair();
      this.handleSession(server, { id: userId, name: userName });
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  handleSession(webSocket, userData) {
    webSocket.accept();
    this.sessions.set(webSocket, userData);

    // Gửi lịch sử chat cho người mới vào
    webSocket.send(JSON.stringify({ type: 'chat_history', messages: this.messages }));

    this.broadcast({ type: 'user_joined', user: userData, participants: Array.from(this.sessions.values()) });

    webSocket.addEventListener('message', async (msg) => {
      try {
        const data = JSON.parse(msg.data);
        
        if (data.type === 'rename') {
          if (userData.id === this.hostId) {
            this.roomName = data.roomName;
            this.broadcast({ type: 'room_renamed', roomName: data.roomName });
          }
        } 
        else if (data.type === 'kick') {
          if (userData.id === this.hostId) {
            for (let [ws, u] of this.sessions.entries()) {
              if (u.id === data.targetId) {
                ws.send(JSON.stringify({ type: 'kicked' }));
                ws.close(1000, "Kicked by host");
                this.sessions.delete(ws);
                this.broadcast({ type: 'user_left', user: u, participants: Array.from(this.sessions.values()) });
                break;
              }
            }
          }
        }
        else if (data.type === 'chat_message') {
          const msgObj = {
            id: crypto.randomUUID(),
            senderId: userData.id,
            senderName: userData.name,
            text: data.text,
            time: new Date().toISOString()
          };
          this.messages.push(msgObj);
          // Giới hạn 100 tin nhắn để tránh rò rỉ bộ nhớ
          if (this.messages.length > 100) this.messages.shift();
          this.broadcast({ type: 'chat_message', message: msgObj });
        }
      } catch (err) {
        console.error(err);
      }
    });

    const handleClose = () => {
      this.sessions.delete(webSocket);
      this.broadcast({ type: 'user_left', user: userData, participants: Array.from(this.sessions.values()) });
    };

    webSocket.addEventListener('close', handleClose);
    webSocket.addEventListener('error', handleClose);
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (let ws of this.sessions.keys()) {
      try { ws.send(data); } catch (e) {}
    }
  }
}

export default app
