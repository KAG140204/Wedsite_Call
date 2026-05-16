import { useState, useEffect, useRef } from 'react';
import { Video as VideoIcon, Mic, MicOff, VideoOff, PhoneOff, MonitorUp, MessageSquare, Users, Edit2, UserMinus, Send, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Peer from 'peerjs';
import { API_BASE_URL, WS_BASE_URL } from '../config';

// Component hiển thị Video Stream
const VideoPlayer = ({ stream, isMuted, isLocal }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isMuted || isLocal} // Luôn tắt tiếng video của chính mình để tránh dội âm (Echo)
      className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`} // Lật ngược video bản thân như gương
    />
  );
};

export default function CallRoom() {
  const { roomId } = useParams();
  const [roomName, setRoomName] = useState('Đang tải...');
  const [participants, setParticipants] = useState([]); // { id, name }
  const [remoteStreams, setRemoteStreams] = useState({}); // { [userId]: MediaStream }
  
  const [hostId, setHostId] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState('');

  // --- CHAT STATE ---
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const wsRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  // Cuộn xuống dòng tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    let isMounted = true;
    let peer = null;

    // 1. Khởi tạo Local Stream (Camera & Mic)
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        
        // 2. Khởi tạo PeerJS
        peer = new Peer(user.id);
        peerRef.current = peer;

        peer.on('open', (id) => {
          // 3. Kết nối WebSocket sau khi Peer đã sẵn sàng
          connectWS();
        });

        peer.on('call', (call) => {
          call.answer(stream);
          call.on('stream', (userVideoStream) => {
            setRemoteStreams(prev => ({ ...prev, [call.peer]: userVideoStream }));
          });
        });

        stream.getAudioTracks()[0].enabled = micOn;
        stream.getVideoTracks()[0].enabled = videoOn;
      } catch (err) {
        setError('Không thể truy cập Camera/Microphone. Vui lòng cấp quyền.');
      }
    };

    // 3. Kết nối WebSocket
    const connectWS = () => {
      const wsUrl = `${WS_BASE_URL}/api/ws/${roomId}?userId=${user.id}&userName=${encodeURIComponent(user.name)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        fetch(`${API_BASE_URL}/api/rooms/${roomId}`)
          .then(res => res.json())
          .then(data => {
            if (isMounted && data.success) {
              setRoomName(data.room.roomName);
              setHostId(data.room.hostId);
              setNewRoomName(data.room.roomName);
            }
          });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (!isMounted) return;

        switch (data.type) {
          case 'user_joined':
            if (data.user.id !== user.id) {
              setParticipants(data.participants.filter(p => p.id !== user.id));
              if (localStreamRef.current && peerRef.current) {
                const call = peerRef.current.call(data.user.id, localStreamRef.current);
                call.on('stream', (userVideoStream) => {
                  setRemoteStreams(prev => ({ ...prev, [data.user.id]: userVideoStream }));
                });
              }
            }
            break;
          case 'user_left':
            setParticipants(data.participants.filter(p => p.id !== user.id));
            setRemoteStreams(prev => {
              const newStreams = { ...prev };
              delete newStreams[data.user.id];
              return newStreams;
            });
            break;
          case 'room_renamed':
            setRoomName(data.roomName);
            break;
          case 'kicked':
            alert('Bạn đã bị chủ phòng mời ra khỏi cuộc gọi!');
            handleLeave();
            break;
          // --- CHAT EVENTS ---
          case 'chat_history':
            setMessages(data.messages || []);
            break;
          case 'chat_message':
            setMessages(prev => [...prev, data.message]);
            // Tăng số thông báo nếu đang đóng chat và tin nhắn không phải của mình
            setIsChatOpen(currentIsOpen => {
              if (!currentIsOpen && data.message.senderId !== user.id) {
                setUnreadCount(p => p + 1);
              }
              return currentIsOpen;
            });
            break;
          default:
            break;
        }
      };

      ws.onclose = () => { if (isMounted) setError('Mất kết nối tới phòng họp.'); };
    };

    initMedia();

    return () => {
      isMounted = false;
      if (wsRef.current) wsRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, user, navigate]);

  const handleLeave = () => {
    navigate('/home');
  };

  const handleRename = () => {
    if (newRoomName.trim() && wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'rename', roomName: newRoomName }));
      setIsEditingName(false);
    }
  };

  const handleKick = (targetId) => {
    if (wsRef.current) wsRef.current.send(JSON.stringify({ type: 'kick', targetId }));
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoOn;
        setVideoOn(!videoOn);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        
        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(videoTrack);
        
        oldTrack.stop();
        videoTrack.enabled = videoOn;
        setIsScreenSharing(false);
        
        Object.keys(peerRef.current.connections).forEach(peerId => {
          const senders = peerRef.current.connections[peerId][0].peerConnection.getSenders();
          const sender = senders.find(s => s.track.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        
        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(screenTrack);
        
        oldTrack.stop();
        setIsScreenSharing(true);

        screenTrack.onended = () => { toggleScreenShare(); };

        Object.keys(peerRef.current.connections).forEach(peerId => {
          const senders = peerRef.current.connections[peerId][0].peerConnection.getSenders();
          const sender = senders.find(s => s.track.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
      }
    } catch (err) {
      console.error('Screen sharing error:', err);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'chat_message', text: chatInput.trim() }));
    setChatInput('');
  };

  if (!user) return null;

  const isHost = user.id === hostId;
  const totalUsers = participants.length + 1;
  let gridCols = 'grid-cols-1 md:grid-cols-2';
  if (totalUsers > 4) gridCols = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  if (totalUsers > 12) gridCols = 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

  return (
    <div className="h-screen w-full flex flex-col bg-gray-950 text-white overflow-hidden">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-2 rounded-full shadow-lg backdrop-blur-md">
          {error}
        </div>
      )}

      <header className="h-16 flex items-center justify-between px-6 glass-panel z-10 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center">
            <VideoIcon className="w-4 h-4 text-white" />
          </div>
          
          {isEditingName ? (
            <div className="flex items-center gap-2 ml-2">
              <input 
                type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                className="bg-gray-800 text-white px-3 py-1 rounded-md border border-purple-500 focus:outline-none"
                autoFocus onKeyDown={e => e.key === 'Enter' && handleRename()}
              />
              <button onClick={handleRename} className="text-xs bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-md font-medium">Lưu</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2 group">
              <h2 className="font-semibold text-lg">{roomName}</h2>
              {isHost && (
                <button onClick={() => setIsEditingName(true)} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all" title="Đổi tên phòng">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">{totalUsers} / 20</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center before:content-[''] before:absolute before:inset-0 before:bg-gray-950/80">
        
        {/* Main Video Area */}
        <main className={`flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center relative z-10 transition-all duration-300 ${isChatOpen ? 'pr-4 md:pr-0' : ''}`}>
          <div className={`w-full max-w-7xl h-full grid ${gridCols} gap-4 auto-rows-fr`}>
            
            {/* Self Video */}
            <div className="relative rounded-2xl overflow-hidden bg-gray-800/80 border border-gray-700 shadow-xl backdrop-blur-md">
              {localStreamRef.current && videoOn ? (
                <VideoPlayer stream={localStreamRef.current} isLocal={!isScreenSharing} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-4xl font-bold shadow-inner">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-white/10 z-10">
                Bạn {isHost && <span className="text-yellow-400 text-xs ml-1">👑 Host</span>}
                {!micOn && <MicOff className="w-3 h-3 text-red-400" />}
              </div>
            </div>

            {/* Other Participants */}
            {participants.map((p) => (
              <div key={p.id} className="relative rounded-2xl overflow-hidden bg-gray-800/80 border border-gray-700 shadow-xl backdrop-blur-md group">
                {remoteStreams[p.id] ? (
                  <VideoPlayer stream={remoteStreams[p.id]} isLocal={false} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center text-4xl font-bold text-indigo-200">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-white/10 z-10">
                  {p.name} {p.id === hostId && <span className="text-yellow-400 text-xs ml-1">👑</span>}
                </div>
                
                {isHost && (
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      onClick={() => handleKick(p.id)}
                      className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-lg backdrop-blur-md flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                      title="Đuổi người này khỏi phòng"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}

          </div>
        </main>

        {/* Chat Sidebar Panel */}
        <aside className={`relative z-20 w-80 lg:w-96 glass-panel border-l border-gray-800 flex flex-col transition-all duration-300 transform ${isChatOpen ? 'translate-x-0' : 'translate-x-full absolute right-0 h-full invisible'}`}>
          <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" /> Trò chuyện
            </h3>
            <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/30">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm text-center">
                Chưa có tin nhắn nào.<br/>Hãy nói lời chào!
              </div>
            ) : (
              messages.map((m, i) => {
                const isMe = m.senderId === user.id;
                return (
                  <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[11px] text-gray-500 mb-1 px-1">
                      {isMe ? 'Bạn' : m.senderName} • {new Date(m.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className={`px-4 py-2 rounded-2xl max-w-[85%] break-words text-sm shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm'}`}>
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-gray-800 bg-gray-950/50 shrink-0">
            <div className="relative flex items-center">
              <input 
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="w-full bg-gray-900 border border-gray-700 rounded-full pl-4 pr-12 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim()}
                className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-full transition-colors flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </aside>

      </div>

      <footer className="h-24 flex items-center justify-center px-6 pb-4 pt-2 gap-2 sm:gap-4 glass-panel border-t border-gray-800 z-10 shrink-0">
        <button onClick={toggleMic} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${micOn ? 'glass-button hover:bg-gray-700' : 'bg-red-500 text-white hover:bg-red-600'}`}>
          {micOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
        
        <button onClick={toggleVideo} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${videoOn ? 'glass-button hover:bg-gray-700' : 'bg-red-500 text-white hover:bg-red-600'}`}>
          {videoOn ? <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
        
        <button onClick={toggleScreenShare} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ml-2 sm:ml-4 transition-all shadow-lg ${isScreenSharing ? 'bg-purple-600 text-white hover:bg-purple-500' : 'glass-button hover:bg-gray-700'}`} title="Chia sẻ màn hình">
          <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        
        <div className="w-px h-8 bg-gray-700 mx-1 sm:mx-2"></div>
        
        {/* Toggle Chat Button */}
        <button 
          onClick={() => { setIsChatOpen(!isChatOpen); setUnreadCount(0); }} 
          className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isChatOpen ? 'bg-blue-600 text-white' : 'glass-button hover:bg-gray-700'}`}
          title="Trò chuyện"
        >
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute top-0 right-0 transform translate-x-1 -translate-y-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-gray-900 animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="w-px h-8 bg-gray-700 mx-1 sm:mx-2"></div>

        <button onClick={handleLeave} className="px-4 sm:px-6 h-10 sm:h-12 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]">
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Rời phòng</span>
        </button>
      </footer>
    </div>
  );
}
