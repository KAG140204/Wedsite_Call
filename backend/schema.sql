DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT,
  avatarUrl TEXT,
  createdAt TEXT
);

DROP TABLE IF EXISTS logs;
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,
  email TEXT,
  details TEXT,
  timestamp TEXT
);

DROP TABLE IF EXISTS rooms;
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  roomName TEXT,
  hostId TEXT,
  hostName TEXT,
  createdAt TEXT,
  members TEXT -- Lưu trữ JSON array các thành viên
);
