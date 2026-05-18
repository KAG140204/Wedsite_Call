import { useState, useEffect, useRef } from 'react';
import { Video as VideoIcon, Mic, MicOff, VideoOff, PhoneOff, MonitorUp, MessageSquare, Users, Edit2, UserMinus, Send, X, Copy, Check, Settings, Volume2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Peer from 'peerjs';
import { API_BASE_URL, WS_BASE_URL } from '../config';

// Component hiển thị Video Stream
const VideoPlayer = ({ stream, isMuted, isLocal, sinkId }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && sinkId && videoRef.current.setSinkId) {
      videoRef.current.setSinkId(sinkId)
        .catch(err => console.error("Error setting sink ID:", err));
    }
  }, [sinkId]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isMuted || isLocal} // Luôn tắt tiếng video của chính mình để tránh dội âm (Echo)
      className={`w-full h-full object-contain bg-black/80 ${isLocal ? 'scale-x-[-1]' : ''}`} // Thay object-cover thành object-contain để không bị cắt xén
    />
  );
};

// Tạo một stream ảo (Silent Audio và Black Video) để làm nền tảng WebRTC khởi tạo không cần xin quyền ngay
const createEmptyStream = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const dst = audioContext.createMediaStreamDestination();
    oscillator.connect(dst);
    oscillator.start();
    const silentAudioTrack = dst.stream.getAudioTracks()[0];

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 640, 480);
    const stream = canvas.captureStream ? canvas.captureStream(1) : null;
    const blackVideoTrack = stream ? stream.getVideoTracks()[0] : null;

    const emptyStream = new MediaStream();
    if (silentAudioTrack) emptyStream.addTrack(silentAudioTrack);
    if (blackVideoTrack) emptyStream.addTrack(blackVideoTrack);
    
    return emptyStream;
  } catch (e) {
    console.error('Failed to create empty placeholder stream', e);
    return new MediaStream();
  }
};

export default function CallRoom() {
  const { roomId } = useParams();
  const [roomName, setRoomName] = useState('Đang tải...');
  const [participants, setParticipants] = useState([]); // { id, name }
  const [remoteStreams, setRemoteStreams] = useState({}); // { [userId]: MediaStream }
  
  const [hostId, setHostId] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // --- CHAT STATE ---
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // --- DEVICE SETTINGS STATE ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCam, setSelectedCam] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      const cams = devices.filter(d => d.kind === 'videoinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');
      
      setAudioInputs(mics);
      setVideoInputs(cams);
      setAudioOutputs(speakers);

      if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId);
      if (cams.length > 0 && !selectedCam) setSelectedCam(cams[0].deviceId);
      if (speakers.length > 0 && !selectedSpeaker) setSelectedSpeaker(speakers[0].deviceId);
    } catch (err) {
      console.error("Lỗi liệt kê thiết bị:", err);
    }
  };

  const openSettings = async () => {
    setIsSettingsOpen(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasLabels = devices.some(d => d.label !== '');
      if (!hasLabels) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        tempStream.getTracks().forEach(t => t.stop());
      }
    } catch (e) {
      console.warn("Chưa cấp quyền thiết bị.");
    }
    await loadDevices();
  };

  const handleMicChange = async (deviceId) => {
    setSelectedMic(deviceId);
    if (micOn) {
      try {
        const constraints = { audio: { deviceId: { exact: deviceId } } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = stream.getAudioTracks()[0];
        
        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getAudioTracks()[0];
          if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
          localStreamRef.current.addTrack(newTrack);
        }
        
        if (peerRef.current) {
          Object.keys(peerRef.current.connections).forEach(peerId => {
            const connList = peerRef.current.connections[peerId];
            if (connList) {
              connList.forEach(conn => {
                if (conn.peerConnection) {
                  const senders = conn.peerConnection.getSenders();
                  const sender = senders.find(s => s.track && s.track.kind === 'audio');
                  if (sender) sender.replaceTrack(newTrack);
                }
              });
            }
          });
        }
      } catch (err) {
        console.error("Lỗi đổi Mic:", err);
      }
    }
  };

  const handleCamChange = async (deviceId) => {
    setSelectedCam(deviceId);
    if (videoOn) {
      try {
        const constraints = { video: { deviceId: { exact: deviceId } } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = stream.getVideoTracks()[0];
        
        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
          localStreamRef.current.addTrack(newTrack);
        }
        
        if (peerRef.current) {
          Object.keys(peerRef.current.connections).forEach(peerId => {
            const connList = peerRef.current.connections[peerId];
            if (connList) {
              connList.forEach(conn => {
                if (conn.peerConnection) {
                  const senders = conn.peerConnection.getSenders();
                  const sender = senders.find(s => s.track && s.track.kind === 'video');
                  if (sender) sender.replaceTrack(newTrack);
                }
              });
            }
          });
        }
      } catch (err) {
        console.error("Lỗi đổi Camera:", err);
      }
    }
  };

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const wsRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const emptyStreamRef = useRef(null);

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

    // 1. Khởi tạo Local Stream (Dùng Silent Audio và Black Video ảo làm mặc định)
    const initMedia = async () => {
      // Khởi tạo stream ảo để tránh hỏi quyền và bật đèn xanh ngay lập tức khi vào phòng
      // Điều này cũng giải quyết hoàn toàn lỗi iOS Safari chặn camera lúc load trang.
      const emptyStream = createEmptyStream();
      emptyStreamRef.current = emptyStream;
      localStreamRef.current = emptyStream;
      
      try {
        // 2. Khởi tạo PeerJS (Luôn khởi chạy kể cả khi chưa xin quyền thiết bị thực tế)
        peer = new Peer(user.id);
        peerRef.current = peer;

        peer.on('open', (id) => {
          // 3. Kết nối WebSocket sau khi Peer đã sẵn sàng
          connectWS();
        });

        peer.on('call', (call) => {
          // Trả lời bằng stream hiện tại (chứa các transceiver ảo sẵn có để thay thế nóng sau này)
          call.answer(localStreamRef.current);
          call.on('stream', (userVideoStream) => {
            setRemoteStreams(prev => ({ ...prev, [call.peer]: userVideoStream }));
          });
        });
      } catch (peerErr) {
        console.error('Lỗi khởi tạo PeerJS:', peerErr);
        setError('Lỗi kết nối mạng ngang hàng.');
      }
    };

    // 3. Kết nối WebSocket
    const connectWS = () => {
      const token = localStorage.getItem('token');
      const wsUrl = `${WS_BASE_URL}/api/ws/${roomId}?userId=${user.id}&userName=${encodeURIComponent(user.name)}&token=${token}`;
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
            // Luôn cập nhật danh sách người tham gia (để người mới vào lấy được danh sách những người đang có mặt)
            setParticipants(data.participants.filter(p => p.id !== user.id));
            
            // Nếu người mới vào KHÔNG PHẢI LÀ MÌNH, mình sẽ chủ động gọi cho họ
            if (data.user.id !== user.id) {
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
      if (emptyStreamRef.current) {
        emptyStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, user, navigate]);

  // --- GOOGLE MEET WORKAROUND: Auto-stop camera on background to save Mic on iOS ---
  const wasVideoOnBeforeHidden = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Trình duyệt bị thu nhỏ hoặc vuốt sang app khác (Background)
        if (videoOn && !isScreenSharing) {
          wasVideoOnBeforeHidden.current = true;
          // TẮT NGAY LẬP TỨC phần cứng camera để iOS Safari không phong tỏa toàn bộ tab
          if (localStreamRef.current) {
            const track = localStreamRef.current.getVideoTracks()[0];
            if (track) track.stop();
          }
          setVideoOn(false);
        }
      } else {
        // Người dùng quay lại trình duyệt (Foreground)
        if (wasVideoOnBeforeHidden.current && !isScreenSharing) {
          try {
            // Tự động xin lại quyền và mở lại camera
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newTrack = stream.getVideoTracks()[0];
            
            if (localStreamRef.current) {
              const oldTrack = localStreamRef.current.getVideoTracks()[0];
              if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
              localStreamRef.current.addTrack(newTrack);
            }

            if (peerRef.current) {
              Object.keys(peerRef.current.connections).forEach(peerId => {
                const connList = peerRef.current.connections[peerId];
                if (connList) {
                  connList.forEach(conn => {
                    if (conn.peerConnection) {
                      const senders = conn.peerConnection.getSenders();
                      const sender = senders.find(s => s.track && s.track.kind === 'video');
                      if (sender) sender.replaceTrack(newTrack);
                    }
                  });
                }
              });
            }
            setVideoOn(true);
          } catch (err) {
            console.error("Lỗi khi khôi phục Camera từ background", err);
          }
          wasVideoOnBeforeHidden.current = false;
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [videoOn, isScreenSharing]);

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

  const toggleMic = async () => {
    if (micOn) {
      if (localStreamRef.current) {
        const track = localStreamRef.current.getAudioTracks()[0];
        if (track) track.stop(); // Tắt hoàn toàn phần cứng (mic tắt)
        
        // Thay thế bằng Silent Audio Track giả đã tạo sẵn để giữ transceiver WebRTC sống
        const silentAudioTrack = emptyStreamRef.current?.getAudioTracks()[0];
        if (silentAudioTrack) {
          localStreamRef.current.removeTrack(track);
          localStreamRef.current.addTrack(silentAudioTrack);
          
          if (peerRef.current) {
            Object.keys(peerRef.current.connections).forEach(peerId => {
              const connList = peerRef.current.connections[peerId];
              if (connList) {
                connList.forEach(conn => {
                  if (conn.peerConnection) {
                    const senders = conn.peerConnection.getSenders();
                    const sender = senders.find(s => s.track && s.track.kind === 'audio');
                    if (sender) sender.replaceTrack(silentAudioTrack);
                  }
                });
              }
            });
          }
        }
      }
      setMicOn(false);
    } else {
      try {
        const constraints = selectedMic ? { audio: { deviceId: { exact: selectedMic } } } : { audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = stream.getAudioTracks()[0];
        
        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getAudioTracks()[0];
          if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
          localStreamRef.current.addTrack(newTrack);
        }

        if (peerRef.current) {
          Object.keys(peerRef.current.connections).forEach(peerId => {
            const connList = peerRef.current.connections[peerId];
            if (connList) {
              connList.forEach(conn => {
                if (conn.peerConnection) {
                  const senders = conn.peerConnection.getSenders();
                  const sender = senders.find(s => s.track && s.track.kind === 'audio');
                  if (sender) sender.replaceTrack(newTrack);
                }
              });
            }
          });
        }
        setMicOn(true);
      } catch (err) {
        console.error("Error turning on mic", err);
      }
    }
  };

  const toggleVideo = async () => {
    if (videoOn) {
      if (localStreamRef.current) {
        const track = localStreamRef.current.getVideoTracks()[0];
        if (track) track.stop(); // Tắt hoàn toàn camera (đèn cam tắt)
        
        // Thay thế bằng Black Video Track giả đã tạo sẵn để giữ transceiver WebRTC sống
        const blackVideoTrack = emptyStreamRef.current?.getVideoTracks()[0];
        if (blackVideoTrack) {
          localStreamRef.current.removeTrack(track);
          localStreamRef.current.addTrack(blackVideoTrack);
          
          if (peerRef.current) {
            Object.keys(peerRef.current.connections).forEach(peerId => {
              const connList = peerRef.current.connections[peerId];
              if (connList) {
                connList.forEach(conn => {
                  if (conn.peerConnection) {
                    const senders = conn.peerConnection.getSenders();
                    const sender = senders.find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(blackVideoTrack);
                  }
                });
              }
            });
          }
        }
      }
      setVideoOn(false);
    } else {
      try {
        const constraints = selectedCam ? { video: { deviceId: { exact: selectedCam } } } : { video: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = stream.getVideoTracks()[0];
        
        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
          localStreamRef.current.addTrack(newTrack);
        }

        if (peerRef.current) {
          Object.keys(peerRef.current.connections).forEach(peerId => {
            const connList = peerRef.current.connections[peerId];
            if (connList) {
              connList.forEach(conn => {
                if (conn.peerConnection) {
                  const senders = conn.peerConnection.getSenders();
                  const sender = senders.find(s => s.track && s.track.kind === 'video');
                  if (sender) sender.replaceTrack(newTrack);
                }
              });
            }
          });
        }
        setVideoOn(true);
      } catch (err) {
        console.error("Error turning on video", err);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        let videoTrack = null;
        if (videoOn) {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoTrack = videoStream.getVideoTracks()[0];
        } else {
          videoTrack = emptyStreamRef.current?.getVideoTracks()[0];
        }
        
        if (videoTrack) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          localStreamRef.current.removeTrack(oldTrack);
          localStreamRef.current.addTrack(videoTrack);
          oldTrack.stop();
          
          videoTrack.enabled = videoOn;
          setIsScreenSharing(false);
          
          if (peerRef.current) {
            Object.keys(peerRef.current.connections).forEach(peerId => {
              const connList = peerRef.current.connections[peerId];
              if (connList) {
                connList.forEach(conn => {
                  if (conn.peerConnection) {
                    const senders = conn.peerConnection.getSenders();
                    const sender = senders.find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                  }
                });
              }
            });
          }
        }
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        
        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(screenTrack);
        
        oldTrack.stop();
        setIsScreenSharing(true);

        screenTrack.onended = () => { toggleScreenShare(); };

        if (peerRef.current) {
          Object.keys(peerRef.current.connections).forEach(peerId => {
            const connList = peerRef.current.connections[peerId];
            if (connList) {
              connList.forEach(conn => {
                if (conn.peerConnection) {
                  const senders = conn.peerConnection.getSenders();
                  const sender = senders.find(s => s.track && s.track.kind === 'video');
                  if (sender) sender.replaceTrack(screenTrack);
                }
              });
            }
          });
        }
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
  
  // Logic tính toán kích thước khung video bằng Flexbox + Aspect Ratio (16:9)
  let itemClass = 'w-full max-w-5xl'; // 1 người: chiếm giữa màn hình, giới hạn max-width
  if (totalUsers === 2) {
    itemClass = 'w-full md:w-[calc(50%-0.5rem)] max-w-4xl'; // 2 người: mobile xếp dọc, desktop xếp ngang
  } else if (totalUsers >= 3 && totalUsers <= 4) {
    itemClass = 'w-[calc(50%-0.5rem)]'; // 3-4 người: chia 2 cột đều nhau
  } else if (totalUsers >= 5 && totalUsers <= 9) {
    itemClass = 'w-[calc(50%-0.5rem)] md:w-[calc(33.33%-0.66rem)]'; // 5-9 người: mobile 2 cột, desktop 3 cột
  } else if (totalUsers > 9) {
    itemClass = 'w-[calc(33.33%-0.66rem)] md:w-[calc(25%-0.75rem)]'; // Nhiều hơn: 3-4 cột
  }

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
            <div className="flex flex-col ml-3">
              <div className="flex items-center gap-2 group">
                <h2 className="font-semibold text-lg">{roomName}</h2>
                {isHost && (
                  <button onClick={() => setIsEditingName(true)} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all" title="Đổi tên phòng">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-0.5">
                <span>ID: {roomId}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                    setCopiedId(roomId);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  className="p-1 hover:text-white transition-colors flex items-center justify-center bg-gray-800/50 rounded hover:bg-gray-700"
                  title="Sao chép ID phòng"
                >
                  {copiedId === roomId ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
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
          <div className="w-full max-w-7xl flex flex-wrap items-center justify-center gap-4">
            
            {/* Self Video */}
            <div className={`relative rounded-2xl overflow-hidden bg-gray-800/80 border border-gray-700 shadow-xl backdrop-blur-md aspect-video flex-shrink-0 transition-all duration-300 ${itemClass}`}>
              {localStreamRef.current && videoOn ? (
                <VideoPlayer stream={localStreamRef.current} isLocal={!isScreenSharing} sinkId={selectedSpeaker} />
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
              <div key={p.id} className={`relative rounded-2xl overflow-hidden bg-gray-800/80 border border-gray-700 shadow-xl backdrop-blur-md group aspect-video flex-shrink-0 transition-all duration-300 ${itemClass}`}>
                {remoteStreams[p.id] ? (
                  <VideoPlayer stream={remoteStreams[p.id]} isLocal={false} sinkId={selectedSpeaker} />
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
        {isChatOpen && (
          <aside className="relative z-20 w-full md:w-80 lg:w-96 glass-panel border-l border-gray-800 flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
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
        )}
      </div>

      <footer className="h-20 sm:h-24 flex items-center justify-center px-4 sm:px-6 pb-3 sm:pb-4 pt-2 gap-2 sm:gap-4 glass-panel border-t border-gray-800 z-10 shrink-0">
        <button onClick={toggleMic} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${micOn ? 'glass-button hover:bg-gray-700' : 'bg-red-500 text-white hover:bg-red-600'}`}>
          {micOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
        
        <button onClick={toggleVideo} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${videoOn ? 'glass-button hover:bg-gray-700' : 'bg-red-500 text-white hover:bg-red-600'}`}>
          {videoOn ? <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
        
        <button onClick={toggleScreenShare} className={`hidden sm:flex w-10 h-10 sm:w-12 sm:h-12 rounded-full items-center justify-center ml-2 sm:ml-4 transition-all shadow-lg ${isScreenSharing ? 'bg-purple-600 text-white hover:bg-purple-500' : 'glass-button hover:bg-gray-700'}`} title="Chia sẻ màn hình">
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

        {/* Cài đặt thiết bị (Settings Button) */}
        <button 
          onClick={openSettings} 
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all shadow-lg glass-button hover:bg-gray-700 text-gray-300 hover:text-white"
          title="Cài đặt thiết bị"
        >
          <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <div className="w-px h-8 bg-gray-700 mx-1 sm:mx-2"></div>

        <button onClick={handleLeave} className="px-4 sm:px-6 h-10 sm:h-12 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]">
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Rời phòng</span>
        </button>
      </footer>

      {/* Settings Modal (Cấu hình thiết bị) */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
              <Settings className="w-5 h-5 text-purple-400" /> Cài đặt thiết bị
            </h3>
            
            <div className="space-y-5">
              {/* Chọn Microphone */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" /> Microphone (Đầu vào)
                </label>
                <select 
                  value={selectedMic} 
                  onChange={e => handleMicChange(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                >
                  {audioInputs.length === 0 ? (
                    <option value="">Không tìm thấy thiết bị</option>
                  ) : (
                    audioInputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone (${d.deviceId.slice(0, 5)})`}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Chọn Camera */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <VideoIcon className="w-3.5 h-3.5" /> Camera (Hình ảnh)
                </label>
                <select 
                  value={selectedCam} 
                  onChange={e => handleCamChange(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                >
                  {videoInputs.length === 0 ? (
                    <option value="">Không tìm thấy thiết bị</option>
                  ) : (
                    videoInputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera (${d.deviceId.slice(0, 5)})`}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Chọn Loa / Output */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" /> Loa / Tai nghe (Đầu ra)
                </label>
                <select 
                  value={selectedSpeaker} 
                  onChange={e => setSelectedSpeaker(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                >
                  {audioOutputs.length === 0 ? (
                    <option value="">Thiết bị mặc định (Hệ thống tự chọn)</option>
                  ) : (
                    audioOutputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Loa (${d.deviceId.slice(0, 5)})`}</option>
                    ))
                  )}
                </select>
              </div>
            </div>
            
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="mt-8 w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 rounded-lg transition-colors text-sm"
            >
              Hoàn tất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
