import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'

const app = new Hono()

// Apply CORS to all routes
app.use('/*', cors({
  origin: (origin) => {
    // Chỉ cho phép localhost (dev) và kaysor-call.pages.dev (chính thức) gọi API
    if (!origin) return 'https://kaysor-call.pages.dev';
    if (origin.includes('localhost') || origin.includes('kaysor-call.pages.dev')) {
      return origin;
    }
    return 'https://kaysor-call.pages.dev';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// Logger Helper (D1)
const logEvent = async (db, action, email, details = '') => {
  await db.prepare('INSERT INTO logs (action, email, details, timestamp) VALUES (?, ?, ?, ?)')
    .bind(action, email, details, new Date().toISOString())
    .run();
};

// ---------------- MIDDLEWARE ----------------

const requireAuth = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Chưa xác thực token' }, 401);
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET || 'secret', 'HS256');
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

  const db = c.env.DB;

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ error: 'Email đã tồn tại' }, 400);
  }

  const hashedPassword = await hashPassword(password);
  const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
  const userId = crypto.randomUUID();

  await db.prepare('INSERT INTO users (id, email, name, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(userId, email, name, hashedPassword, role, new Date().toISOString())
    .run();

  await logEvent(db, 'REGISTER', email, `Người dùng mới đăng ký: ${name}`);

  return c.json({ success: true, message: 'Đăng ký thành công' });
});

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'Vui lòng nhập email và mật khẩu' }, 400);

  const db = c.env.DB;
  const hashedPassword = await hashPassword(password);

  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND password = ?')
    .bind(email, hashedPassword)
    .first();

  if (!user) {
    return c.json({ error: 'Email hoặc mật khẩu không chính xác' }, 401);
  }

  const token = await sign({
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  }, c.env.JWT_SECRET || 'secret');

  await logEvent(db, 'LOGIN', email, `Đăng nhập thành công`);

  return c.json({
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl }
  });
});

// ---------------- ADMIN API ----------------

app.get('/api/admin/users', adminAuth, async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT id, name, email, role, avatarUrl, createdAt FROM users').all();
  return c.json({ success: true, users: results || [] });
});

app.get('/api/admin/rooms', adminAuth, async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT * FROM rooms').all();
  const rooms = (results || []).map(r => ({ ...r, roomId: r.id, members: JSON.parse(r.members || '[]') }));
  return c.json({ success: true, rooms });
});

app.get('/api/admin/logs', adminAuth, async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100').all();
  return c.json({ success: true, logs: results || [] });
});

// --- Admin Stats ---
app.get('/api/admin/stats', adminAuth, async (c) => {
  const db = c.env.DB;
  const totalUsers = (await db.prepare('SELECT COUNT(*) as count FROM users').first()).count;
  const totalRooms = (await db.prepare('SELECT COUNT(*) as count FROM rooms').first()).count;
  
  const today = new Date().toISOString().split('T')[0];
  const todayActivity = (await db.prepare("SELECT COUNT(*) as count FROM logs WHERE timestamp LIKE ?").bind(`${today}%`).first()).count;
  
  // Phòng có thành viên > 0
  const { results: roomRows } = await db.prepare('SELECT members FROM rooms').all();
  const activeRooms = (roomRows || []).filter(r => {
    const members = JSON.parse(r.members || '[]');
    return members.length > 0;
  }).length;
  
  return c.json({ success: true, stats: { totalUsers, totalRooms, todayActivity, activeRooms } });
});

// --- Admin Chart Data (7 ngày gần nhất) ---
app.get('/api/admin/chart', adminAuth, async (c) => {
  const db = c.env.DB;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    
    const logins = (await db.prepare("SELECT COUNT(*) as count FROM logs WHERE action = 'LOGIN' AND timestamp LIKE ?").bind(`${dateStr}%`).first()).count;
    const registers = (await db.prepare("SELECT COUNT(*) as count FROM logs WHERE action = 'REGISTER' AND timestamp LIKE ?").bind(`${dateStr}%`).first()).count;
    const rooms = (await db.prepare("SELECT COUNT(*) as count FROM logs WHERE action = 'CREATE_ROOM' AND timestamp LIKE ?").bind(`${dateStr}%`).first()).count;
    
    days.push({ label, logins, registers, rooms });
  }
  return c.json({ success: true, chart: days });
});

// --- Delete User ---
app.delete('/api/admin/users/:userId', adminAuth, async (c) => {
  const userId = c.req.param('userId');
  const admin = c.get('user');
  const db = c.env.DB;
  
  if (userId === admin.id) return c.json({ error: 'Không thể xóa chính mình' }, 400);
  
  const target = await db.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();
  if (!target) return c.json({ error: 'Không tìm thấy người dùng' }, 404);
  
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  await logEvent(db, 'ADMIN_DELETE_USER', admin.email, `Xóa user: ${target.email}`);
  
  return c.json({ success: true });
});

// --- Delete Room ---
app.delete('/api/admin/rooms/:roomId', adminAuth, async (c) => {
  const roomId = c.req.param('roomId');
  const admin = c.get('user');
  const db = c.env.DB;
  
  await db.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();
  await logEvent(db, 'ADMIN_DELETE_ROOM', admin.email, `Xóa phòng: ${roomId}`);
  
  return c.json({ success: true });
});

// --- Update User Role ---
app.put('/api/admin/users/:userId/role', adminAuth, async (c) => {
  const userId = c.req.param('userId');
  const admin = c.get('user');
  const { role } = await c.req.json();
  const db = c.env.DB;
  
  if (userId === admin.id) return c.json({ error: 'Không thể đổi role chính mình' }, 400);
  if (!['admin', 'user'].includes(role)) return c.json({ error: 'Role không hợp lệ' }, 400);
  
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
  
  const target = await db.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();
  await logEvent(db, 'ADMIN_CHANGE_ROLE', admin.email, `Đổi role ${target?.email} → ${role}`);
  
  return c.json({ success: true });
});

// --- Admin Report (Date Range) ---
app.get('/api/admin/report', adminAuth, async (c) => {
  const db = c.env.DB;
  const from = c.req.query('from'); // YYYY-MM-DD
  const to = c.req.query('to');     // YYYY-MM-DD
  
  if (!from || !to) return c.json({ error: 'Cần truyền from và to' }, 400);
  
  const toNext = to + 'T23:59:59';
  
  // Thống kê tổng
  const newUsers = (await db.prepare("SELECT COUNT(*) as count FROM users WHERE createdAt >= ? AND createdAt <= ?").bind(from, toNext).first()).count;
  const newRooms = (await db.prepare("SELECT COUNT(*) as count FROM rooms WHERE createdAt >= ? AND createdAt <= ?").bind(from, toNext).first()).count;
  const totalLogins = (await db.prepare("SELECT COUNT(*) as count FROM logs WHERE action = 'LOGIN' AND timestamp >= ? AND timestamp <= ?").bind(from, toNext).first()).count;
  const totalActions = (await db.prepare("SELECT COUNT(*) as count FROM logs WHERE timestamp >= ? AND timestamp <= ?").bind(from, toNext).first()).count;
  
  // Breakdown theo ngày
  const { results: logRows } = await db.prepare("SELECT * FROM logs WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC").bind(from, toNext).all();
  
  const dailyMap = {};
  (logRows || []).forEach(l => {
    const day = l.timestamp?.split('T')[0];
    if (!day) return;
    if (!dailyMap[day]) dailyMap[day] = { date: day, logins: 0, registers: 0, rooms: 0, others: 0 };
    if (l.action === 'LOGIN') dailyMap[day].logins++;
    else if (l.action === 'REGISTER') dailyMap[day].registers++;
    else if (l.action === 'CREATE_ROOM') dailyMap[day].rooms++;
    else dailyMap[day].others++;
  });
  
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  
  return c.json({ success: true, report: { newUsers, newRooms, totalLogins, totalActions, daily } });
});

// ---------------- USER API (Nhóm/Phòng & Cập nhật Profile) ----------------

app.get('/api/user/rooms', requireAuth, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT * FROM rooms').all();
  // Lọc các phòng mà người dùng là thành viên
  const userRooms = (results || []).filter(r => {
    const members = JSON.parse(r.members || '[]');
    return members.some(m => m.id === user.id);
  }).map(r => ({ ...r, roomId: r.id, members: JSON.parse(r.members || '[]') }));
  return c.json({ success: true, rooms: userRooms });
});

app.put('/api/user/profile', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { newName, oldPassword, newPassword } = body;
  const db = c.env.DB;
  
  if (!newName && !newPassword) return c.json({ error: 'Không có dữ liệu cập nhật' }, 400);

  const dbUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  if (!dbUser) {
    return c.json({ error: 'Không tìm thấy người dùng' }, 404);
  }

  if (newPassword) {
    if (!oldPassword) return c.json({ error: 'Cần nhập mật khẩu cũ' }, 400);
    const hashedOld = await hashPassword(oldPassword);
    if (hashedOld !== dbUser.password) {
      return c.json({ error: 'Mật khẩu cũ không đúng' }, 400);
    }
    const hashedNew = await hashPassword(newPassword);
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').bind(hashedNew, user.id).run();
  }

  if (newName) {
    await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(newName, user.id).run();
  }

  await logEvent(db, 'UPDATE_PROFILE', dbUser.email, `Cập nhật hồ sơ`);

  return c.json({ success: true, user: { name: newName || dbUser.name } });
});

// ---------------- AVATAR UPLOAD (ImgBB) ----------------

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
    const db = c.env.DB;
    
    await db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').bind(avatarUrl, user.id).run();
    await logEvent(db, 'UPDATE_AVATAR', user.email || 'unknown', 'Người dùng đã tải ảnh đại diện mới qua ImgBB');
    
    return c.json({ success: true, avatarUrl });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Lỗi kết nối máy chủ ImgBB' }, 500);
  }
});

// ---------------- ROOMS & WEBSOCKETS (DURABLE OBJECTS) ----------------

app.post('/api/rooms', requireAuth, async (c) => {
  const { roomName, hostId, hostName } = await c.req.json()
  
  // Tạo ID 20 kí tự
  const shortId = crypto.randomUUID().substring(0, 20);
  const id = c.env.ROOM_SESSION.idFromName(shortId);
  const roomId = shortId;
  const db = c.env.DB;

  const members = JSON.stringify([{ id: hostId, name: hostName }]);
  
  await db.prepare('INSERT INTO rooms (id, roomName, hostId, hostName, createdAt, updatedAt, members) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(roomId, roomName || 'Phòng mới', hostId, hostName, new Date().toISOString(), new Date().toISOString(), members)
    .run();
  
  const user = c.get('user');
  await logEvent(db, 'CREATE_ROOM', user.email || hostName, `Tạo phòng: ${roomId}`);
  
  const stub = c.env.ROOM_SESSION.get(id)
  await stub.fetch(new Request('http://internal/init', {
    method: 'POST',
    body: JSON.stringify({ hostId, roomName: roomName || 'Phòng mới' }),
    headers: { 'Content-Type': 'application/json' }
  }))

  const roomData = { roomId, roomName: roomName || 'Phòng mới', hostId, createdBy: hostName, members: [{ id: hostId, name: hostName }] };
  return c.json({ success: true, room: roomData })
})

app.post('/api/rooms/:roomId/join', requireAuth, async (c) => {
  const roomId = c.req.param('roomId');
  const user = c.get('user');
  const { userName } = await c.req.json();
  const db = c.env.DB;
  
  const room = await db.prepare('SELECT members FROM rooms WHERE id = ?').bind(roomId).first();
  if (room) {
    const members = JSON.parse(room.members || '[]');
    if (!members.some(m => m.id === user.id)) {
      members.push({ id: user.id, name: userName });
    }
    await db.prepare('UPDATE rooms SET members = ?, updatedAt = ? WHERE id = ?').bind(JSON.stringify(members), new Date().toISOString(), roomId).run();
  }
  
  return c.json({ success: true });
});

app.post('/api/rooms/:roomId/leave', requireAuth, async (c) => {
  const roomId = c.req.param('roomId');
  const user = c.get('user');
  const db = c.env.DB;
  
  const room = await db.prepare('SELECT members FROM rooms WHERE id = ?').bind(roomId).first();
  if (room) {
    const members = JSON.parse(room.members || '[]').filter(m => m.id !== user.id);
    await db.prepare('UPDATE rooms SET members = ?, updatedAt = ? WHERE id = ?').bind(JSON.stringify(members), new Date().toISOString(), roomId).run();
  }
  
  return c.json({ success: true });
});

app.get('/api/rooms/:roomId', async (c) => {
  const roomId = c.req.param('roomId')
  const db = c.env.DB;
  try {
    const roomFromDB = await db.prepare('SELECT roomName, hostId FROM rooms WHERE id = ?').bind(roomId).first();
    if (!roomFromDB) {
      return c.json({ error: 'Mã phòng không tồn tại' }, 404)
    }

    const isHex64 = /^[0-9a-f]{64}$/i.test(roomId);
    const id = isHex64 ? c.env.ROOM_SESSION.idFromString(roomId) : c.env.ROOM_SESSION.idFromName(roomId);
    const stub = c.env.ROOM_SESSION.get(id)
    const res = await stub.fetch(new Request('http://internal/info'))
    const data = await res.json()
    
    return c.json({ 
      success: true, 
      room: { 
        roomId, 
        ...data, 
        roomName: roomFromDB.roomName, 
        hostId: roomFromDB.hostId || data.hostId 
      } 
    })
  } catch (err) {
    return c.json({ error: 'Mã phòng không hợp lệ hoặc phòng đã đóng' }, 500)
  }
})

app.get('/api/ws/:roomId', async (c) => {
  const roomId = c.req.param('roomId')
  try {
    const isHex64 = /^[0-9a-f]{64}$/i.test(roomId);
    const id = isHex64 ? c.env.ROOM_SESSION.idFromString(roomId) : c.env.ROOM_SESSION.idFromName(roomId);
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
      const token = url.searchParams.get('token');
      const parts = url.pathname.split('/');
      this.roomId = parts[parts.length - 1];

      if (!userId || !userName || !token) {
        return new Response("Missing auth info", { status: 400 });
      }

      // Xác thực JWT bảo mật tuyệt đối cho WebSocket
      try {
        const payload = await verify(token, this.env.JWT_SECRET || 'secret', 'HS256');
        if (payload.id !== userId) {
          return new Response("Unauthorized Fake ID", { status: 403 });
        }
      } catch (err) {
        return new Response("Invalid Token", { status: 401 });
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
          if (userData.id === this.hostId || !this.hostId) {
            this.roomName = data.roomName;
            this.broadcast({ type: 'room_renamed', roomName: data.roomName });
            if (this.env.DB && this.roomId) {
              this.env.DB.prepare('UPDATE rooms SET roomName = ? WHERE id = ?')
                .bind(data.roomName, this.roomId).run().catch(console.error);
            }
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
