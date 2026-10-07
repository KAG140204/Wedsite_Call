import { useState, useEffect, useRef } from 'react';
import { Video as VideoIcon, Mic, MicOff, VideoOff, PhoneOff, MonitorUp, MessageSquare, Users, Edit2, UserMinus, Send, X, Copy, Check, Settings, Volume2, Wifi, Palette, Smile, Sparkles, Pin, PinOff, BarChart2, HelpCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Peer from 'peerjs';
import { API_BASE_URL, WS_BASE_URL } from '../config';
import { gsap } from 'gsap';

// Component hiển thị Video Stream
const VideoPlayer = ({ stream, isMuted, isLocal, sinkId, micOn, videoOn }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      
      const playVideo = () => {
        video.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.warn("Autoplay blocked or interrupted:", err);
          }
        });
      };

      // Đảm bảo video phát lại ngay khi metadata được tải (cần thiết cho iOS Safari & Android Chrome)
      video.onloadedmetadata = playVideo;
      playVideo();

      return () => {
        if (video) video.onloadedmetadata = null;
      };
    }
  }, [stream, micOn, videoOn]); // Khi đối phương bật/tắt thiết bị, nạp lại stream để ép trình duyệt tái kích hoạt bộ giải mã âm thanh

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
      webkit-playsinline="true"
      muted={isMuted || isLocal} // Luôn tắt tiếng video của chính mình để tránh dội âm (Echo)
      className={`w-full h-full object-contain bg-black/80 ${isLocal ? 'scale-x-[-1]' : ''}`} // Thay object-cover thành object-contain để không bị cắt xén
    />
  );
};

// Component phát âm thanh của người dùng khác độc lập với Camera
const RemoteAudio = ({ stream, sinkId }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      
      // Kích hoạt phát lại âm thanh chủ động, giải quyết triệt để vấn đề autoplay chặn tiếng
      audioRef.current.play()
        .catch(err => console.warn("Audio autoplay blocked:", err));
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current && sinkId && audioRef.current.setSinkId) {
      audioRef.current.setSinkId(sinkId)
        .catch(err => console.error("Error setting speaker sink ID for audio:", err));
    }
  }, [sinkId]);

  return (
    <audio 
      ref={audioRef} 
      autoPlay 
      playsInline 
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        opacity: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        clip: 'rect(0, 0, 0, 0)'
      }} 
    />
  );
};

// Tạo một stream ảo (Silent Audio và Black Video) để làm nền tảng WebRTC khởi tạo không cần xin quyền ngay
const createEmptyStream = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const dst = audioContext.createMediaStreamDestination();
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

  // --- SCREEN SHARE DEDICATED STATE ---
  const screenStreamRef = useRef(null); // Luồng màn hình riêng (chỉ người share có)
  const [screenSharerName, setScreenSharerName] = useState(null); // Tên người đang share (bao gồm chính mình)
  const [remoteScreenStream, setRemoteScreenStream] = useState(null); // Luồng màn hình nhận từ người khác

  // --- PARTICIPANTS MEDIA STATES ---
  const [participantsMedia, setParticipantsMedia] = useState({}); // { [userId]: { micOn, videoOn } }

  const micOnRef = useRef(false);
  const videoOnRef = useRef(false);
  const isScreenSharingRef = useRef(false);

  // --- CHAT STATE ---
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // --- DRAGGABLE TOOLBAR STATE & LOGIC ---
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0 });

  const isDraggingRef = useRef(false);

  const handleDragStart = (e) => {
    // Nếu click trúng button thì ưu tiên xử lý click thông thường, không kéo
    if (e.target.closest('button')) return;
    
    isDraggingRef.current = true;
    setIsDragging(true);
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = {
      startX: clientX - menuPos.x,
      startY: clientY - menuPos.y
    };
  };

  useEffect(() => {
    const handleDragMove = (e) => {
      if (!isDraggingRef.current) return;
      
      // Ngăn chặn hành vi cuộn mặc định của trình duyệt để kéo mượt mà
      if (e.cancelable) {
        e.preventDefault();
      }
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const newX = clientX - dragStartRef.current.startX;
      const newY = clientY - dragStartRef.current.startY;
      
      setMenuPos({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [menuPos]);

  // --- VOICE VISUALIZER & PING STATE & LOGIC ---
  const [speakingUsers, setSpeakingUsers] = useState({}); // { [userId]: boolean }
  const [userPings, setUserPings] = useState({}); // { [userId]: number }
  const speakingAudioContextRef = useRef(null);
  const speakingAnalysersRef = useRef({}); // { [userId]: AnalyserNode }

  const setupAudioAnalyser = (userId, stream) => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    try {
      if (!speakingAudioContextRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        speakingAudioContextRef.current = new AudioContextClass();
      }
      const ctx = speakingAudioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      if (speakingAnalysersRef.current[userId]) return;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      speakingAnalysersRef.current[userId] = analyser;
    } catch (err) {
      console.warn("Lỗi khởi tạo Audio Analyser cho " + userId, err);
    }
  };

  const removeAudioAnalyser = (userId) => {
    if (speakingAnalysersRef.current[userId]) {
      delete speakingAnalysersRef.current[userId];
    }
  };

  // Vòng lặp phát hiện tiếng nói
  useEffect(() => {
    const checkSpeaking = setInterval(() => {
      if (!speakingAudioContextRef.current) return;
      const newSpeaking = {};
      const dataArray = new Uint8Array(128);

      Object.keys(speakingAnalysersRef.current).forEach(userId => {
        const analyser = speakingAnalysersRef.current[userId];
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 128; i++) {
          sum += dataArray[i];
        }
        const average = sum / 128;
        newSpeaking[userId] = average > 12; // Ngưỡng bắt đầu nói
      });

      setSpeakingUsers(newSpeaking);
    }, 150);

    return () => {
      clearInterval(checkSpeaking);
      if (speakingAudioContextRef.current) {
        speakingAudioContextRef.current.close().catch(console.error);
        speakingAudioContextRef.current = null;
      }
      speakingAnalysersRef.current = {};
    };
  }, []);

  // Theo dõi remoteStreams để tạo/xóa analysers
  useEffect(() => {
    Object.keys(remoteStreams).forEach(userId => {
      const stream = remoteStreams[userId];
      if (stream) {
        setupAudioAnalyser(userId, stream);
      }
    });

    Object.keys(speakingAnalysersRef.current).forEach(userId => {
      if (userId !== 'local' && !remoteStreams[userId]) {
        removeAudioAnalyser(userId);
      }
    });
  }, [remoteStreams]);

  // Theo dõi micOn để bật/tắt analyser local
  // Lưu ý: localStreamRef và peerRef được khai báo SAU đoạn này trong component,
  // nhưng useEffect callback chỉ chạy SAU render nên an toàn khi truy cập bên trong body.
  // KHÔNG ĐƯỢC đặt ref.current vào dependency array vì nó được đánh giá lúc render (gây TDZ crash).
  useEffect(() => {
    if (micOn && localStreamRef?.current) {
      setupAudioAnalyser('local', localStreamRef.current);
    } else {
      removeAudioAnalyser('local');
    }
  }, [micOn]);

  // Vòng lặp đo Ping WebRTC (mỗi 3 giây)
  useEffect(() => {
    const checkPings = setInterval(async () => {
      if (!peerRef.current || !peerRef.current.connections) return;
      const newPings = {};

      for (const peerId of Object.keys(peerRef.current.connections)) {
        const connList = peerRef.current.connections[peerId];
        const mediaConn = connList?.find(c => c.type === 'media');
        if (mediaConn?.peerConnection) {
          try {
            const stats = await mediaConn.peerConnection.getStats();
            stats.forEach(report => {
              if (report.type === 'candidate-pair' && report.currentRoundTripTime !== undefined) {
                newPings[peerId] = Math.round(report.currentRoundTripTime * 1000);
              }
            });
          } catch (e) {
            console.error("Lỗi lấy stats ping cho peer " + peerId, e);
          }
        }
      }
      setUserPings(newPings);
    }, 3000);

    return () => clearInterval(checkPings);
  }, [participants]);

  // --- DEVICE SETTINGS STATE ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'default');
  const [isEmojiPanelOpen, setIsEmojiPanelOpen] = useState(false);
  const [noiseSuppressionOn, setNoiseSuppressionOn] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState(null); // 'local' hoặc id của remote user
  const noiseAudioCtxRef = useRef(null); // AudioContext cho bộ lọc tạp âm
  
  // --- INTERACTIVE SIDEBAR STATE (CHAT, POLLS, Q&A) ---
  const [sidebarTab, setSidebarTab] = useState('chat'); // 'chat' | 'polls' | 'qa'
  const [polls, setPolls] = useState([]);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [showPollCreator, setShowPollCreator] = useState(false);
  
  const [questions, setQuestions] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [highlightedQuestion, setHighlightedQuestion] = useState(null); // Trạng thái câu hỏi đang được ghim lên màn hình chiếu
  
  // --- VIRTUAL BACKGROUND STATE & REFS ---
  const [virtualBg, setVirtualBg] = useState('none'); // 'none' | 'blur' | 'image'
  const [selectedBgImage, setSelectedBgImage] = useState('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=640&auto=format&fit=crop');
  const [isVirtualBgLoading, setIsVirtualBgLoading] = useState(false);
  const virtualBgRef = useRef('none');
  const selectedBgImageRef = useRef('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=640&auto=format&fit=crop');
  const segVideoRef = useRef(null);
  const segCanvasRef = useRef(null);
  const rawVideoStreamRef = useRef(null); // Lưu stream webcam thô để làm đầu vào xử lý
  const selfieSegRef = useRef(null);
  const bgImgElementRef = useRef(null);
  
  useEffect(() => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    virtualBgRef.current = virtualBg;
  }, [virtualBg]);

  useEffect(() => {
    selectedBgImageRef.current = selectedBgImage;
    if (selectedBgImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = selectedBgImage;
      img.onload = () => {
        bgImgElementRef.current = img;
      };
    }
  }, [selectedBgImage]);

  const [audioInputs, setAudioInputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCam, setSelectedCam] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');

  // Trạng thái nhảy nhịp âm lượng mic trong Settings Modal
  const [micLevel, setMicLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationFrameRef = useRef(null);

  const startMicVisualizer = (stream) => {
    stopMicVisualizer();
    if (!stream) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        const average = total / bufferLength;
        
        // Chuẩn hóa mức volume sang tỷ lệ 0-100%, có nhân hệ số để mức nhảy nhạy bén và rõ rệt
        const level = Math.min(100, Math.round((average / 110) * 100));
        setMicLevel(level);

        animationFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.error("Lỗi khởi tạo visualizer mic:", err);
    }
  };

  const stopMicVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setMicLevel(0);
  };

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
    let targetMicId = selectedMic;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const hasMic = devices.some(d => d.kind === 'audioinput');
      const hasCam = devices.some(d => d.kind === 'videoinput');
      
      const hasMicLabel = devices.some(d => d.kind === 'audioinput' && d.label !== '');
      const hasCamLabel = devices.some(d => d.kind === 'videoinput' && d.label !== '');
      
      // Xin quyền Microphone nếu có phần cứng mic nhưng chưa được cấp quyền (nhãn rỗng)
      if (hasMic && !hasMicLabel) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream.getTracks().forEach(t => t.stop());
        } catch (micErr) {
          console.warn("Không thể xin quyền Mic:", micErr);
        }
      }
      
      // Xin quyền Camera nếu có phần cứng camera nhưng chưa được cấp quyền (nhãn rỗng)
      if (hasCam && !hasCamLabel) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          camStream.getTracks().forEach(t => t.stop());
        } catch (camErr) {
          console.warn("Không thể xin quyền Camera:", camErr);
        }
      }
    } catch (e) {
      console.warn("Lỗi kiểm tra quyền thiết bị:", e);
    }
    
    // Tải và đồng bộ thiết bị
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      const cams = devices.filter(d => d.kind === 'videoinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');
      
      setAudioInputs(mics);
      setVideoInputs(cams);
      setAudioOutputs(speakers);

      if (mics.length > 0) {
        if (!selectedMic) {
          setSelectedMic(mics[0].deviceId);
          targetMicId = mics[0].deviceId;
        }
      }
      if (cams.length > 0 && !selectedCam) setSelectedCam(cams[0].deviceId);
      if (speakers.length > 0 && !selectedSpeaker) setSelectedSpeaker(speakers[0].deviceId);
    } catch (err) {
      console.error("Lỗi nạp thiết bị:", err);
    }

    // Khởi chạy luồng test mic nhảy nhịp cục bộ trong modal
    try {
      const testConstraints = targetMicId ? { audio: { deviceId: { exact: targetMicId } } } : { audio: true };
      const tempStream = await navigator.mediaDevices.getUserMedia(testConstraints);
      micStreamRef.current = tempStream;
      startMicVisualizer(tempStream);
    } catch (err) {
      console.warn("Không thể kích hoạt test mic trong cài đặt:", err);
    }
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    stopMicVisualizer();
  };

  const handleMicChange = async (deviceId) => {
    setSelectedMic(deviceId);
    
    // 1. Cập nhật luồng test mic cục bộ trong modal
    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const testConstraints = { 
        audio: { 
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: false, // Tắt lọc ồn để tiếng thô trong trẻo, chân thực
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16
        } 
      };
      const tempStream = await navigator.mediaDevices.getUserMedia(testConstraints);
      micStreamRef.current = tempStream;
      startMicVisualizer(tempStream);
    } catch (err) {
      console.error("Lỗi thay đổi thiết bị test mic:", err);
    }

    // 2. Nếu mic đang bật trong cuộc gọi, thay thế nóng WebRTC track
    if (micOn) {
      try {
        const constraints = { 
          audio: { 
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: false, // Tắt lọc ồn để tiếng thô trong trẻo, chân thực
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
            sampleSize: 16
          } 
        };
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
                  if (sender) {
                    sender.replaceTrack(newTrack);
                  } else {
                    try {
                      conn.peerConnection.addTrack(newTrack, localStreamRef.current);
                    } catch (trackErr) {
                      console.warn("Lỗi addTrack dự phòng khi đổi Mic:", trackErr);
                    }
                  }
                }
              });
            }
          });
        }
      } catch (err) {
        console.error("Lỗi đổi Mic cuộc gọi:", err);
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

  const broadcastMediaState = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'media_state',
        micOn: micOnRef.current,
        videoOn: videoOnRef.current
      }));
    }
  };

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const wsRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const emptyStreamRef = useRef(null);

  // Khóa cuộn trang toàn màn hình ở body & html để cố định giao diện call
  useEffect(() => {
    document.body.classList.add('overflow-hidden', 'fixed', 'w-full', 'h-full');
    document.documentElement.classList.add('overflow-hidden');
    
    return () => {
      document.body.classList.remove('overflow-hidden', 'fixed', 'w-full', 'h-full');
      document.documentElement.classList.remove('overflow-hidden');
    };
  }, []);

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
      
      // Tải trước danh sách thiết bị sẵn có (không xin quyền ngầm)
      loadDevices();
      
      try {
        // 2. Khởi tạo PeerJS (Luôn khởi chạy kể cả khi chưa xin quyền thiết bị thực tế)
        peer = new Peer(user.id);
        peerRef.current = peer;

        peer.on('open', (id) => {
          // 3. Kết nối WebSocket sau khi Peer đã sẵn sàng
          connectWS();
        });

        peer.on('call', (call) => {
          const isScreenCall = call.metadata?.type === 'screen';
          
          if (isScreenCall) {
            // Cuộc gọi screen share: Trả lời kèm empty stream để mobile (iOS/Android WebRTC)
            // hoàn tất đàm phán SDP thành công và kích hoạt sự kiện on('stream')
            const sharerName = call.metadata?.sharerName || 'Người tham gia';
            setScreenSharerName(sharerName);

            const emptyAnswerStream = createEmptyStream();
            call.answer(emptyAnswerStream);

            call.on('stream', (screenVideoStream) => {
              setRemoteScreenStream(screenVideoStream);
              setScreenSharerName(call.metadata?.sharerName || sharerName);
            });
            call.on('close', () => {
              setRemoteScreenStream(null);
              setScreenSharerName(null);
            });
            call.on('error', (err) => {
              console.warn("Screen call error:", err);
            });
          } else {
            // Cuộc gọi camera/mic bình thường
            call.answer(localStreamRef.current || createEmptyStream());
            call.on('stream', (userVideoStream) => {
              setRemoteStreams(prev => ({ ...prev, [call.peer]: userVideoStream }));
            });
          }
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
            
            // Broadcast trạng thái mic/cam hiện tại của mình để người mới biết
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'media_state',
                micOn: micOnRef.current,
                videoOn: videoOnRef.current
              }));
            }

            // Nếu người mới vào KHÔNG PHẢI LÀ MÌNH, mình sẽ chủ động gọi cho họ
            if (data.user.id !== user.id) {
              if (localStreamRef.current && peerRef.current) {
                const call = peerRef.current.call(data.user.id, localStreamRef.current);
                call.on('stream', (userVideoStream) => {
                  setRemoteStreams(prev => ({ ...prev, [data.user.id]: userVideoStream }));
                });
              }

              // Nếu mình đang share màn hình, chủ động gọi truyền luồng màn hình cho người mới
              if (isScreenSharingRef.current && screenStreamRef.current && peerRef.current) {
                peerRef.current.call(data.user.id, screenStreamRef.current, { 
                  metadata: { 
                    type: 'screen',
                    sharerName: user.name,
                    sharerId: user.id
                  } 
                });
                
                // Đồng thời gửi tin nhắn ws thông báo mình đang share màn hình để người mới hiển thị khung chiếu
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'screen_share',
                    sharing: true,
                    userName: user.name
                  }));
                }
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
            setParticipantsMedia(prev => {
              const newMedia = { ...prev };
              delete newMedia[data.user.id];
              return newMedia;
            });
            // Nếu người rời phòng đang share màn hình, xóa luồng screen
            if (screenSharerName === data.user.name) {
              setScreenSharerName(null);
              setRemoteScreenStream(null);
            }
            break;
          case 'room_renamed':
            setRoomName(data.roomName);
            break;
          case 'kicked':
            alert('Bạn đã bị chủ phòng mời ra khỏi cuộc gọi!');
            handleLeave();
            break;
          case 'media_state':
            setParticipantsMedia(prev => ({
              ...prev,
              [data.userId]: { micOn: data.micOn, videoOn: data.videoOn }
            }));
            break;
          case 'screen_share':
            if (data.sharing) {
              setScreenSharerName(data.userName);
            } else {
              setScreenSharerName(null);
              setRemoteScreenStream(null);
            }
            break;
          // --- CHAT EVENTS ---
          case 'chat_history':
            setMessages(data.messages || []);
            break;
          case 'poll_history':
            setPolls(data.polls || []);
            break;
          case 'qa_history':
            setQuestions(data.questions || []);
            const highlighted = (data.questions || []).find(q => q.isHighlighted);
            if (highlighted) {
              setHighlightedQuestion(highlighted);
            }
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
          case 'emoji_reaction':
            showEmojiBubble(data.senderId, data.emoji);
            break;
          // --- POLL EVENTS ---
          case 'poll_create':
            setPolls(prev => [...prev, data.poll]);
            break;
          case 'poll_vote':
            setPolls(prev => prev.map(p => {
              if (p.id === data.pollId) {
                return {
                  ...p,
                  options: p.options.map((opt, idx) => {
                    if (idx === data.optionIndex) {
                      const voted = opt.votes.includes(data.voterId);
                      const newVotes = voted 
                        ? opt.votes.filter(id => id !== data.voterId) 
                        : [...opt.votes, data.voterId];
                      return { ...opt, votes: newVotes };
                    } else {
                      return { ...opt, votes: opt.votes.filter(id => id !== data.voterId) };
                    }
                  })
                };
              }
              return p;
            }));
            break;
          // --- Q&A EVENTS ---
          case 'qa_ask':
            setQuestions(prev => [data.question, ...prev]);
            break;
          case 'qa_upvote':
            setQuestions(prev => prev.map(q => {
              if (q.id === data.questionId) {
                const upvoted = q.upvotes.includes(data.voterId);
                const newUpvotes = upvoted 
                  ? q.upvotes.filter(id => id !== data.voterId) 
                  : [...q.upvotes, data.voterId];
                return { ...q, upvotes: newUpvotes };
              }
              return q;
            }));
            break;
          case 'qa_highlight':
            setHighlightedQuestion(data.question);
            break;
          case 'qa_resolve':
            setQuestions(prev => prev.map(q => {
              if (q.id === data.questionId) {
                return { ...q, isResolved: data.isResolved };
              }
              return q;
            }));
            setHighlightedQuestion(prev => {
              if (prev && prev.id === data.questionId && data.isResolved) {
                return null;
              }
              return prev;
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
          videoOnRef.current = false;
          broadcastMediaState();
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
            videoOnRef.current = true;
            broadcastMediaState();
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

  // --- AI NOISE SUPPRESSION & VOICE ENHANCEMENT ---
  const toggleNoiseFilter = async (enable) => {
    setNoiseSuppressionOn(enable);
    if (!localStreamRef.current || !micOn) return;

    if (enable) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();
        noiseAudioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(localStreamRef.current);

        // High-pass filter: Cắt tần số dưới 85Hz (loại bỏ tiếng ù, tiếng quạt, tiếng AC)
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 85;
        highpass.Q.value = 0.7;

        // Low-pass filter: Cắt tần số trên 14kHz (loại bỏ tiếng rít, nhiễu cao tần)
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 14000;
        lowpass.Q.value = 0.7;

        // Dynamics Compressor: Nén dải động giúp chuẩn hóa âm lượng giọng nói
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-36, ctx.currentTime);
        compressor.knee.setValueAtTime(12, ctx.currentTime);
        compressor.ratio.setValueAtTime(4, ctx.currentTime);
        compressor.attack.setValueAtTime(0.05, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);

        // Gain: Tăng âm lượng sau khi nén
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.4, ctx.currentTime);

        const destination = ctx.createMediaStreamDestination();

        // Chain: source → highpass → lowpass → compressor → gain → destination
        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(compressor);
        compressor.connect(gain);
        gain.connect(destination);

        const processedTrack = destination.stream.getAudioTracks()[0];

        // Thay thế audio track trong localStream
        const oldTrack = localStreamRef.current.getAudioTracks()[0];
        if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(processedTrack);

        // Cập nhật track cho tất cả peer connections
        if (peerRef.current) {
          Object.keys(peerRef.current.connections).forEach(peerId => {
            const connList = peerRef.current.connections[peerId];
            if (connList) {
              connList.forEach(conn => {
                if (conn.peerConnection) {
                  const senders = conn.peerConnection.getSenders();
                  const sender = senders.find(s => s.track && s.track.kind === 'audio');
                  if (sender) sender.replaceTrack(processedTrack);
                }
              });
            }
          });
        }
      } catch (err) {
        console.error('Lỗi khởi tạo bộ lọc tạp âm:', err);
        setNoiseSuppressionOn(false);
      }
    } else {
      // Tắt bộ lọc: Lấy lại audio track gốc từ thiết bị
      if (noiseAudioCtxRef.current) {
        noiseAudioCtxRef.current.close().catch(console.error);
        noiseAudioCtxRef.current = null;
      }
      try {
        const constraints = {
          audio: selectedMic
            ? { deviceId: { exact: selectedMic }, echoCancellation: true, noiseSuppression: false, autoGainControl: true }
            : { echoCancellation: true, noiseSuppression: false, autoGainControl: true }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const rawTrack = stream.getAudioTracks()[0];

        const oldTrack = localStreamRef.current.getAudioTracks()[0];
        if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(rawTrack);

        if (peerRef.current) {
          Object.keys(peerRef.current.connections).forEach(peerId => {
            const connList = peerRef.current.connections[peerId];
            if (connList) {
              connList.forEach(conn => {
                if (conn.peerConnection) {
                  const senders = conn.peerConnection.getSenders();
                  const sender = senders.find(s => s.track && s.track.kind === 'audio');
                  if (sender) sender.replaceTrack(rawTrack);
                }
              });
            }
          });
        }
      } catch (err) {
        console.error('Lỗi khôi phục audio gốc:', err);
      }
    }
  };

  const showEmojiBubble = (senderId, emoji) => {
    const container = document.getElementById(senderId === 'local' ? 'video-local' : `video-${senderId}`);
    if (!container) return;

    const emojiEl = document.createElement('div');
    emojiEl.innerText = emoji;
    emojiEl.className = 'absolute bottom-12 left-1/2 -translate-x-1/2 text-4xl pointer-events-none select-none z-30 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)]';
    container.appendChild(emojiEl);

    gsap.fromTo(emojiEl, 
      { 
        y: 0, 
        x: 0,
        opacity: 0, 
        scale: 0.3,
        rotation: 0
      }, 
      { 
        y: -120 - Math.random() * 80, 
        x: (Math.random() - 0.5) * 100, 
        opacity: 1, 
        scale: 1.6, 
        rotation: (Math.random() - 0.5) * 45,
        duration: 1.0, 
        ease: 'back.out(1.7)',
        onComplete: () => {
          gsap.to(emojiEl, {
            y: '-=40',
            opacity: 0,
            scale: 0.9,
            duration: 0.4,
            ease: 'power1.in',
            onComplete: () => {
              emojiEl.remove();
            }
          });
        }
      }
    );
  };

  const sendEmojiReaction = (emoji) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'emoji_reaction',
        emoji,
        senderId: user.id,
        senderName: user.name
      }));
    }
    showEmojiBubble('local', emoji);
    setIsEmojiPanelOpen(false);
  };

  const handleLeave = () => {
    // Dọn dẹp tài nguyên AI Virtual Background
    if (rawVideoStreamRef.current) {
      rawVideoStreamRef.current.getTracks().forEach(t => t.stop());
      rawVideoStreamRef.current = null;
    }
    if (segVideoRef.current) {
      segVideoRef.current.srcObject = null;
      segVideoRef.current.remove();
      segVideoRef.current = null;
    }
    if (segCanvasRef.current) {
      segCanvasRef.current.remove();
      segCanvasRef.current = null;
    }
    if (selfieSegRef.current) {
      selfieSegRef.current.close?.();
      selfieSegRef.current = null;
    }
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
      micOnRef.current = false;
      broadcastMediaState();
    } else {
      try {
        const constraints = {
          audio: selectedMic 
            ? { 
                deviceId: { exact: selectedMic }, 
                echoCancellation: true, 
                noiseSuppression: false, // Tắt lọc ồn để tiếng thô trong trẻo, chân thực
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 48000,
                sampleSize: 16
              }
            : { 
                echoCancellation: true, 
                noiseSuppression: false, // Tắt lọc ồn để tiếng thô trong trẻo, chân thực
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 48000,
                sampleSize: 16
              }
        };
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
                  if (sender) {
                    sender.replaceTrack(newTrack);
                  } else {
                    try {
                      conn.peerConnection.addTrack(newTrack, localStreamRef.current);
                    } catch (trackErr) {
                      console.warn("Lỗi addTrack dự phòng khi bật Mic:", trackErr);
                    }
                  }
                }
              });
            }
          });
        }
        setMicOn(true);
        micOnRef.current = true;
        broadcastMediaState();
      } catch (err) {
        console.error("Error turning on mic", err);
      }
    }
  };

  // --- AI VIRTUAL BACKGROUND ENGINE ---
  
  const loadSelfieSegmentation = () => {
    return new Promise((resolve, reject) => {
      if (window.SelfieSegmentation) {
        resolve(window.SelfieSegmentation);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
      script.async = true;
      script.onload = () => {
        if (window.SelfieSegmentation) {
          resolve(window.SelfieSegmentation);
        } else {
          reject(new Error('SelfieSegmentation not found on window'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load SelfieSegmentation script'));
      document.head.appendChild(script);
    });
  };

  const startBackgroundProcessor = async (rawStream) => {
    try {
      setIsVirtualBgLoading(true);
      const SelfieSegmentationClass = await loadSelfieSegmentation();
      
      if (!segVideoRef.current) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.display = 'none';
        document.body.appendChild(video);
        segVideoRef.current = video;
      }
      
      if (!segCanvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
        segCanvasRef.current = canvas;
      }

      const video = segVideoRef.current;
      const canvas = segCanvasRef.current;
      const ctx = canvas.getContext('2d');

      video.srcObject = rawStream;
      await video.play();

      if (!selfieSegRef.current) {
        const selfieSegmentation = new SelfieSegmentationClass({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });
        selfieSegmentation.setOptions({
          modelSelection: 1,
        });
        selfieSegmentation.onResults((results) => {
          if (!canvas || !ctx) return;
          const width = canvas.width;
          const height = canvas.height;

          ctx.save();
          ctx.clearRect(0, 0, width, height);

          ctx.drawImage(results.segmentationMask, 0, 0, width, height);

          ctx.globalCompositeOperation = 'source-in';
          ctx.drawImage(results.image, 0, 0, width, height);

          ctx.globalCompositeOperation = 'destination-over';
          
          const currentEffect = virtualBgRef.current;
          if (currentEffect === 'blur') {
            ctx.filter = 'blur(10px)';
            ctx.drawImage(results.image, 0, 0, width, height);
            ctx.filter = 'none';
          } else if (currentEffect === 'image' && bgImgElementRef.current) {
            ctx.drawImage(bgImgElementRef.current, 0, 0, width, height);
          } else {
            ctx.drawImage(results.image, 0, 0, width, height);
          }
          ctx.restore();
        });
        selfieSegRef.current = selfieSegmentation;
      }

      let active = true;
      const processFrame = async () => {
        if (!active) return;
        if (virtualBgRef.current !== 'none' && video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            await selfieSegRef.current.send({ image: video });
          } catch (e) {
            console.warn("Lỗi xử lý frame MediaPipe:", e);
          }
        }
        if (video.requestVideoFrameCallback) {
          video.requestVideoFrameCallback(processFrame);
        } else {
          requestAnimationFrame(processFrame);
        }
      };

      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(processFrame);
      } else {
        requestAnimationFrame(processFrame);
      }

      const canvasStream = canvas.captureStream(30);
      setIsVirtualBgLoading(false);
      return canvasStream;
    } catch (err) {
      console.error("Lỗi khởi tạo bộ lọc nền AI:", err);
      setIsVirtualBgLoading(false);
      return rawStream;
    }
  };

  const handleUpdateBackgroundEffect = async (effect, imageSrc = null) => {
    if (!videoOn) {
      setVirtualBg(effect);
      if (imageSrc) setSelectedBgImage(imageSrc);
      return;
    }

    try {
      const oldBg = virtualBgRef.current;
      setVirtualBg(effect);
      if (imageSrc) setSelectedBgImage(imageSrc);

      let targetVideoTrack = null;

      if (effect === 'none') {
        if (rawVideoStreamRef.current) {
          targetVideoTrack = rawVideoStreamRef.current.getVideoTracks()[0];
        }
      } else {
        if (oldBg === 'none') {
          if (rawVideoStreamRef.current) {
            const processedStream = await startBackgroundProcessor(rawVideoStreamRef.current);
            targetVideoTrack = processedStream.getVideoTracks()[0];
          }
        } else {
          return;
        }
      }

      if (targetVideoTrack && localStreamRef.current) {
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack) {
          localStreamRef.current.removeTrack(currentVideoTrack);
          localStreamRef.current.addTrack(targetVideoTrack);
        }

        if (peerRef.current) {
          Object.keys(peerRef.current.connections).forEach(peerId => {
            const connList = peerRef.current.connections[peerId];
            if (connList) {
              connList.forEach(conn => {
                if (conn.peerConnection) {
                  const senders = conn.peerConnection.getSenders();
                  const sender = senders.find(s => s.track && s.track.kind === 'video');
                  if (sender) sender.replaceTrack(targetVideoTrack);
                }
              });
            }
          });
        }
      }
    } catch (e) {
      console.error("Lỗi cập nhật hiệu ứng nền:", e);
    }
  };

  const toggleVideo = async () => {
    if (videoOn) {
      if (localStreamRef.current) {
        const track = localStreamRef.current.getVideoTracks()[0];
        if (track) track.stop();
        
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
      if (rawVideoStreamRef.current) {
        rawVideoStreamRef.current.getVideoTracks().forEach(t => t.stop());
        rawVideoStreamRef.current = null;
      }
      setVideoOn(false);
      videoOnRef.current = false;
      broadcastMediaState();
    } else {
      try {
        const constraints = selectedCam ? { video: { deviceId: { exact: selectedCam } } } : { video: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        rawVideoStreamRef.current = stream;
        
        let newTrack = stream.getVideoTracks()[0];
        
        if (virtualBg !== 'none') {
          const processedStream = await startBackgroundProcessor(stream);
          newTrack = processedStream.getVideoTracks()[0];
        }

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
                  if (sender) {
                    sender.replaceTrack(newTrack);
                  } else {
                    try {
                      conn.peerConnection.addTrack(newTrack, localStreamRef.current);
                    } catch (trackErr) {
                      console.warn("Lỗi addTrack dự phòng khi bật Camera:", trackErr);
                    }
                  }
                }
              });
            }
          });
        }
        setVideoOn(true);
        videoOnRef.current = true;
        broadcastMediaState();
      } catch (err) {
        console.error("Error turning on video", err);
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setScreenSharerName(null);

    // Thông báo cho tất cả người khác rằng mình ngừng share
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'screen_share', sharing: false }));
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharingRef.current || screenStreamRef.current) {
        stopScreenShare();
      } else {
        // === BẬT SCREEN SHARE ===
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          alert('Trình duyệt hiện tại không hỗ trợ tính năng chia sẻ màn hình. Trên di động, vui lòng mở trang web bằng Safari (iOS 15.1 trở lên) hoặc Chrome (Android).');
          return;
        }

        let screenStream;
        try {
          // Chuẩn hỗ trợ tối đa cho cả iOS Safari (15.1+) và Android Chrome
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true
          });
        } catch (mediaErr) {
          if (mediaErr.name === 'NotAllowedError') {
            // Người dùng hủy hộp thoại chọn màn hình
            return;
          }
          try {
            // Thử lại với ràng buộc bổ sung nếu trình duyệt hỗ trợ
            screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: { cursor: 'always' },
              audio: false
            });
          } catch (retryErr) {
            if (retryErr.name === 'NotAllowedError') return;
            throw retryErr;
          }
        }

        if (!screenStream) return;
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        // Lưu stream màn hình riêng biệt (KHÔNG thay thế camera track)
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        isScreenSharingRef.current = true;
        setScreenSharerName(user.name);

        // Gửi luồng màn hình cho tất cả peer hiện có bằng lệnh call mới (metadata đánh dấu là screen)
        if (peerRef.current) {
          participants.forEach(p => {
            const call = peerRef.current.call(p.id, screenStream, { 
              metadata: { 
                type: 'screen',
                sharerName: user.name,
                sharerId: user.id
              } 
            });
            if (call) {
              call.on('error', err => console.warn('Lỗi gửi screen share cho', p.id, err));
            }
          });
        }

        // Thông báo cho tất cả người khác rằng mình đang share
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
            type: 'screen_share', 
            sharing: true,
            userName: user.name
          }));
        }

        // Khi người dùng nhấn "Stop sharing" từ trình duyệt hoặc thanh hệ điều hành
        screenTrack.onended = () => { 
          stopScreenShare(); 
        };
      }
    } catch (err) {
      console.error('Screen sharing error:', err);
      if (err.name !== 'NotAllowedError') {
        alert('Không thể chia sẻ màn hình: ' + (err.message || 'Lỗi quyền hoặc thiết bị không hỗ trợ'));
      }
    }
  };

  // --- POLL HELPER FUNCTIONS ---
  const handleCreatePoll = (question, optionsList) => {
    if (!question.trim() || !wsRef.current) return;
    const validOptions = optionsList.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) return;

    const newPoll = {
      id: crypto.randomUUID(),
      question: question.trim(),
      options: validOptions.map(opt => ({ text: opt.trim(), votes: [] })),
      creatorId: user.id,
      creatorName: user.name,
      isActive: true,
      timestamp: new Date().toISOString()
    };

    wsRef.current.send(JSON.stringify({
      type: 'poll_create',
      poll: newPoll
    }));

    setNewPollQuestion('');
    setNewPollOptions(['', '']);
    setShowPollCreator(false);
  };

  const handleVotePoll = (pollId, optionIndex) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'poll_vote',
      pollId,
      optionIndex,
      voterId: user.id
    }));
  };

  // --- Q&A HELPER FUNCTIONS ---
  const handleAskQuestion = (text) => {
    if (!text.trim() || !wsRef.current) return;

    const newQuestion = {
      id: crypto.randomUUID(),
      text: text.trim(),
      authorId: user.id,
      authorName: user.name,
      upvotes: [],
      isHighlighted: false,
      isResolved: false,
      timestamp: new Date().toISOString()
    };

    wsRef.current.send(JSON.stringify({
      type: 'qa_ask',
      question: newQuestion
    }));

    setNewQuestionText('');
  };

  const handleUpvoteQuestion = (questionId) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'qa_upvote',
      questionId,
      voterId: user.id
    }));
  };

  const handleHighlightQuestion = (question) => {
    if (!wsRef.current) return;
    const nextQuestion = highlightedQuestion?.id === question.id ? null : question;
    wsRef.current.send(JSON.stringify({
      type: 'qa_highlight',
      question: nextQuestion
    }));
  };

  const handleResolveQuestion = (questionId, currentStatus) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'qa_resolve',
      questionId,
      isResolved: !currentStatus
    }));
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
  if (screenSharerName || pinnedUserId) {
    itemClass = 'w-32 sm:w-44 md:w-56 aspect-video shrink-0';
  } else if (totalUsers === 2) {
    itemClass = 'w-full md:w-[calc(50%-0.5rem)] max-w-4xl'; // 2 người: mobile xếp dọc, desktop xếp ngang
  } else if (totalUsers >= 3 && totalUsers <= 4) {
    itemClass = 'w-[calc(50%-0.5rem)]'; // 3-4 người: chia 2 cột đều nhau
  } else if (totalUsers >= 5 && totalUsers <= 9) {
    itemClass = 'w-[calc(50%-0.5rem)] md:w-[calc(33.33%-0.66rem)]'; // 5-9 người: mobile 2 cột, desktop 3 cột
  } else if (totalUsers > 9) {
    itemClass = 'w-[calc(33.33%-0.66rem)] md:w-[calc(25%-0.75rem)]'; // Nhiều hơn: 3-4 cột
  }

  return (
    <div className="h-dvh w-full flex flex-col bg-gray-950 text-white overflow-hidden">
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
          
          {/* Q&A Highlight Banner Overlay */}
          {highlightedQuestion && (
            <div className="w-full max-w-2xl bg-gradient-to-r from-purple-900/95 via-indigo-900/95 to-blue-900/95 border border-purple-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(168,85,247,0.3)] mb-4 animate-in slide-in-from-top-4 duration-300 relative z-20 flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 shrink-0">
                <HelpCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-purple-300 uppercase font-bold tracking-wider mb-0.5">Câu hỏi đang thảo luận</div>
                <p className="text-white text-base font-semibold leading-relaxed break-words">{highlightedQuestion.text}</p>
                <div className="text-xs text-gray-400 mt-2 font-medium">Đặt bởi: <span className="text-purple-300 font-semibold">{highlightedQuestion.authorName}</span></div>
              </div>
              {isHost && (
                <button 
                  onClick={() => handleHighlightQuestion(highlightedQuestion)} 
                  className="p-1 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                  title="Ẩn ghim câu hỏi"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          
          {/* Dành riêng cho màn chiếu Screen Share */}
          {(screenSharerName || remoteScreenStream) && (screenStreamRef.current || remoteScreenStream) && (
            <div className="w-full max-w-6xl aspect-video min-h-[220px] rounded-2xl overflow-hidden bg-black/90 border border-purple-500/30 shadow-2xl relative mb-4">
              <VideoPlayer 
                stream={screenSharerName === user.name && screenStreamRef.current ? screenStreamRef.current : (remoteScreenStream || screenStreamRef.current)} 
                isMuted={true} 
                isLocal={false} 
                sinkId={selectedSpeaker} 
              />
              <div className="absolute bottom-3 left-3 bg-purple-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium border border-purple-500/20 z-10 flex items-center gap-2">
                <MonitorUp className="w-4 h-4 text-purple-300 animate-pulse" />
                <span>Đang trình chiếu: {screenSharerName === user.name ? 'Bạn' : (screenSharerName || 'Người tham gia')}</span>
              </div>
            </div>
          )}

          {/* Cinema Mode Pinned User Area */}
          {pinnedUserId && !screenSharerName && (
            <div className="w-full max-w-6xl aspect-video rounded-2xl overflow-hidden bg-black/90 border border-blue-500/30 shadow-2xl relative mb-4 group">
              {pinnedUserId === 'local' ? (
                localStreamRef.current && videoOn ? (
                  <VideoPlayer stream={localStreamRef.current} isLocal={true} sinkId={selectedSpeaker} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-4xl sm:text-5xl font-bold shadow-inner">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )
              ) : (
                (() => {
                  const p = participants.find(part => part.id === pinnedUserId);
                  if (!p) return null;
                  const pMedia = participantsMedia[p.id] || { micOn: false, videoOn: false };
                  const stream = remoteStreams[p.id];
                  return (
                    <>
                      {stream && pMedia.videoOn ? (
                        <VideoPlayer stream={stream} isMuted={true} isLocal={false} sinkId={selectedSpeaker} micOn={pMedia.micOn} videoOn={pMedia.videoOn} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center text-4xl sm:text-5xl font-bold text-indigo-200">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                      )}
                      {stream && <RemoteAudio stream={stream} sinkId={selectedSpeaker} />}
                    </>
                  );
                })()
              )}

              <div className="absolute top-4 right-4 z-20">
                <button 
                  onClick={() => setPinnedUserId(null)} 
                  className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-blue-400 hover:text-white transition-colors border border-white/10"
                  title="Bỏ ghim"
                >
                  <PinOff className="w-5 h-5" />
                </button>
              </div>

              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-white/10 z-10">
                <span>Ghim: {pinnedUserId === 'local' ? 'Bạn' : (participants.find(p => p.id === pinnedUserId)?.name || '')}</span>
              </div>
            </div>
          )}

          <div className={`w-full max-w-7xl gap-4 ${screenSharerName || pinnedUserId ? 'flex items-center justify-start overflow-x-auto py-2 px-1 scrollbar-thin' : 'flex flex-wrap items-center justify-center'}`}>
            
            {/* Self Video */}
            {(!pinnedUserId || pinnedUserId !== 'local' || screenSharerName) && (
              <div id="video-local" className={`relative group rounded-2xl overflow-hidden bg-gray-800/80 border border-gray-700 shadow-xl backdrop-blur-md aspect-video flex-shrink-0 transition-all duration-300 ${itemClass} ${speakingUsers['local'] ? 'speaking-ring-glow' : ''}`}>
                {localStreamRef.current && videoOn ? (
                  <VideoPlayer stream={localStreamRef.current} isLocal={true} sinkId={selectedSpeaker} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-4xl font-bold shadow-inner">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-white/10 z-10">
                  <span>Bạn</span> {isHost && <span className="text-yellow-400 text-xs ml-1">👑 Host</span>}
                  {!micOn && <MicOff className="w-3 h-3 text-red-400" />}
                  
                  {/* Sóng âm thanh động khi đang nói */}
                  {speakingUsers['local'] && (
                    <div className="flex items-end gap-0.5 h-3.5 w-3 ml-1" title="Đang nói">
                      <div className="w-0.5 bg-purple-400 rounded-full voice-wave-bar-1" style={{ height: '100%' }}></div>
                      <div className="w-0.5 bg-purple-400 rounded-full voice-wave-bar-2" style={{ height: '70%' }}></div>
                      <div className="w-0.5 bg-purple-400 rounded-full voice-wave-bar-3" style={{ height: '85%' }}></div>
                    </div>
                  )}
                </div>

                {/* Pin button overlay for local user */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={() => setPinnedUserId('local')}
                    className="p-1.5 rounded bg-black/60 hover:bg-black/80 text-white transition-colors border border-white/10"
                    title="Ghim màn hình"
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Other Participants */}
            {participants.filter(p => p.id !== pinnedUserId || screenSharerName).map((p) => {
              const pMedia = participantsMedia[p.id] || { micOn: false, videoOn: false };
              const isSpeaking = speakingUsers[p.id];
              const ping = userPings[p.id];
              return (
                <div key={p.id} id={`video-${p.id}`} className={`relative rounded-2xl overflow-hidden bg-gray-800/80 border border-gray-700 shadow-xl backdrop-blur-md group aspect-video flex-shrink-0 transition-all duration-300 ${itemClass} ${isSpeaking ? 'speaking-ring-glow' : ''}`}>
                  {/* Luôn phát âm thanh của đối phương độc lập với camera qua thẻ <audio> riêng biệt */}
                  {remoteStreams[p.id] && (
                    <RemoteAudio stream={remoteStreams[p.id]} sinkId={selectedSpeaker} />
                  )}

                  {/* Render VideoPlayer chỉ khi Camera đang bật (ở chế độ Muted để không bị dội âm) */}
                  {remoteStreams[p.id] && pMedia.videoOn ? (
                    <VideoPlayer 
                      stream={remoteStreams[p.id]} 
                      isMuted={true} 
                      isLocal={false} 
                      sinkId={selectedSpeaker} 
                      micOn={pMedia.micOn} 
                      videoOn={pMedia.videoOn} 
                    />
                  ) : (
                    /* Hiển thị Avatar Placeholder phủ lên khi camera tắt */
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center text-4xl font-bold text-indigo-200">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-white/10 z-10">
                    <span>{p.name}</span> {p.id === hostId && <span className="text-yellow-400 text-xs ml-1">👑</span>}
                    {!pMedia.micOn && <MicOff className="w-3 h-3 text-red-400 ml-1" />}
                    
                    {/* Sóng âm thanh động khi đang nói */}
                    {isSpeaking && (
                      <div className="flex items-end gap-0.5 h-3.5 w-3 ml-1" title="Đang nói">
                        <div className="w-0.5 bg-purple-400 rounded-full voice-wave-bar-1" style={{ height: '100%' }}></div>
                        <div className="w-0.5 bg-purple-400 rounded-full voice-wave-bar-2" style={{ height: '70%' }}></div>
                        <div className="w-0.5 bg-purple-400 rounded-full voice-wave-bar-3" style={{ height: '85%' }}></div>
                      </div>
                    )}

                    {/* Vạch Ping và độ trễ */}
                    {ping !== undefined && (
                      <div 
                        className={`flex items-center gap-1 text-[10px] font-semibold font-mono ${
                          ping < 60 ? 'text-green-400' : ping < 150 ? 'text-yellow-400' : 'text-red-400'
                        } bg-black/40 px-1.5 py-0.5 rounded border border-white/5 ml-1`}
                        title={`Độ trễ WebRTC: ${ping}ms`}
                      >
                        <Wifi className="w-3 h-3 shrink-0" />
                        <span>{ping}ms</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Pin and Kick buttons for other participants */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                    <button 
                      onClick={() => setPinnedUserId(p.id)}
                      className="p-1.5 rounded bg-black/60 hover:bg-black/80 text-white transition-colors border border-white/10"
                      title="Ghim màn hình"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    {isHost && (
                      <button 
                        onClick={() => handleKick(p.id)}
                        className="bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded border border-red-500/20 backdrop-blur-md flex items-center justify-center transition-transform hover:scale-110"
                        title="Đuổi người này khỏi phòng"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        </main>

        {/* Interactive Sidebar Panel */}
        {isChatOpen && (
          <aside className="fixed inset-0 md:relative md:inset-auto z-50 md:z-20 w-full md:w-80 lg:w-96 glass-panel md:border-l border-gray-800 bg-gray-950 md:bg-gray-950/30 flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-800 shrink-0">
              <button 
                onClick={() => setSidebarTab('chat')} 
                className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${sidebarTab === 'chat' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                <MessageSquare className="w-4 h-4" /> Trò chuyện
              </button>
              <button 
                onClick={() => setSidebarTab('polls')} 
                className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${sidebarTab === 'polls' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                <BarChart2 className="w-4 h-4" /> Khảo sát
              </button>
              <button 
                onClick={() => setSidebarTab('qa')} 
                className={`flex-1 py-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${sidebarTab === 'qa' ? 'border-pink-500 text-pink-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                <HelpCircle className="w-4 h-4" /> Q&A
              </button>
              <button 
                onClick={() => setIsChatOpen(false)} 
                className="px-3 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB CONTENT: CHAT */}
            {sidebarTab === 'chat' && (
              <>
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
              </>
            )}

            {/* TAB CONTENT: POLLS */}
            {sidebarTab === 'polls' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/30">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {showPollCreator ? (
                    // Form tạo khảo sát
                    <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 space-y-3 shadow-lg">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tạo khảo sát mới</div>
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Câu hỏi khảo sát</label>
                        <input 
                          type="text"
                          value={newPollQuestion}
                          onChange={e => setNewPollQuestion(e.target.value)}
                          placeholder="Ví dụ: Bạn thấy tính năng này thế nào?"
                          className="w-full bg-gray-950 border border-gray-850 text-white rounded-lg px-3 py-2 text-xs placeholder-gray-600 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] text-gray-400">Các lựa chọn</label>
                        {newPollOptions.map((opt, idx) => (
                          <input 
                            key={idx}
                            type="text"
                            value={opt}
                            onChange={e => {
                              const updated = [...newPollOptions];
                              updated[idx] = e.target.value;
                              setNewPollOptions(updated);
                            }}
                            placeholder={`Lựa chọn ${idx + 1}`}
                            className="w-full bg-gray-950 border border-gray-850 text-white rounded-lg px-3 py-1.5 text-xs placeholder-gray-600 focus:outline-none focus:border-purple-500"
                          />
                        ))}
                        <button 
                          type="button" 
                          onClick={() => setNewPollOptions([...newPollOptions, ''])}
                          className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold"
                        >
                          + Thêm lựa chọn
                        </button>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => setShowPollCreator(false)}
                          className="flex-1 bg-gray-850 hover:bg-gray-850/80 text-gray-300 text-xs py-2 rounded-lg font-medium"
                        >
                          Hủy
                        </button>
                        <button 
                          onClick={() => handleCreatePoll(newPollQuestion, newPollOptions)}
                          disabled={!newPollQuestion.trim() || newPollOptions.filter(o => o.trim()).length < 2}
                          className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs py-2 rounded-lg font-medium"
                        >
                          Tạo ngay
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Nút mở form tạo khảo sát (Chỉ Host được tạo khảo sát)
                    isHost && (
                      <button 
                        onClick={() => setShowPollCreator(true)}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-purple-950/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
                      >
                        + Tạo cuộc khảo sát mới
                      </button>
                    )
                  )}

                  {/* Danh sách khảo sát */}
                  <div className="space-y-4">
                    {polls.length === 0 ? (
                      <div className="text-center text-gray-500 text-xs py-8">
                        Chưa có cuộc khảo sát nào.
                      </div>
                    ) : (
                      [...polls].reverse().map((poll) => {
                        const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
                        return (
                          <div key={poll.id} className="bg-gray-900/60 border border-gray-800/80 rounded-xl p-4 space-y-3">
                            <div>
                              <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1">Khảo sát • Đặt bởi {poll.creatorName}</div>
                              <h4 className="text-sm font-semibold text-white leading-snug">{poll.question}</h4>
                            </div>
                            <div className="space-y-2">
                              {poll.options.map((opt, idx) => {
                                const optionVotes = opt.votes.length;
                                const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                                const hasVoted = opt.votes.includes(user.id);
                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => handleVotePoll(poll.id, idx)}
                                    className={`w-full relative overflow-hidden rounded-lg p-2.5 text-left text-xs border transition-all ${hasVoted ? 'bg-purple-900/30 border-purple-500/50 text-white' : 'bg-gray-950 border-gray-850 hover:bg-gray-950/70 text-gray-300'}`}
                                  >
                                    <div 
                                      className="absolute inset-y-0 left-0 bg-purple-500/10 transition-all duration-300 pointer-events-none"
                                      style={{ width: `${pct}%` }}
                                    />
                                    <div className="relative z-10 flex justify-between items-center font-medium">
                                      <span className="truncate pr-4">{opt.text}</span>
                                      <span className="shrink-0 font-mono text-[11px] text-purple-400">{optionVotes} phiếu ({pct}%)</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-gray-500 text-right">Tổng số lượt bình chọn: {totalVotes}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Q&A */}
            {sidebarTab === 'qa' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/30">
                <div className="p-3 border-b border-gray-800 bg-gray-950/20 shrink-0">
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={newQuestionText}
                      onChange={e => setNewQuestionText(e.target.value)}
                      placeholder="Đặt câu hỏi của bạn..."
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                      onKeyDown={e => e.key === 'Enter' && handleAskQuestion(newQuestionText)}
                    />
                    <button 
                      onClick={() => handleAskQuestion(newQuestionText)}
                      disabled={!newQuestionText.trim()}
                      className="bg-pink-600 hover:bg-pink-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs px-3 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Hỏi
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {questions.length === 0 ? (
                    <div className="text-center text-gray-500 text-xs py-8">
                      Chưa có câu hỏi nào.<br/>Hãy là người đầu tiên đặt câu hỏi!
                    </div>
                  ) : (
                    [...questions]
                      .sort((a, b) => {
                        if (a.isResolved !== b.isResolved) return a.isResolved ? 1 : -1;
                        return b.upvotes.length - a.upvotes.length;
                      })
                      .map((q) => {
                        const hasUpvoted = q.upvotes.includes(user.id);
                        const isHighlighted = highlightedQuestion?.id === q.id;
                        return (
                          <div 
                            key={q.id} 
                            className={`border rounded-xl p-3.5 space-y-2 transition-all ${
                              q.isResolved 
                                ? 'bg-gray-950/20 border-gray-850 opacity-60' 
                                : isHighlighted 
                                  ? 'bg-pink-950/20 border-pink-500/50 shadow-md shadow-pink-950/10' 
                                  : 'bg-gray-900/60 border-gray-800'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-[10px] text-gray-500 font-medium">{q.authorName} • {new Date(q.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                <p className={`text-xs font-semibold leading-relaxed break-words mt-1 ${q.isResolved ? 'line-through text-gray-500' : 'text-white'}`}>{q.text}</p>
                              </div>
                              <button 
                                onClick={() => handleUpvoteQuestion(q.id)}
                                disabled={q.isResolved}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold font-mono transition-colors ${
                                  hasUpvoted 
                                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-400' 
                                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                ▲ {q.upvotes.length}
                              </button>
                            </div>

                            {isHost && (
                              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800/50">
                                <button 
                                  onClick={() => handleHighlightQuestion(q)}
                                  disabled={q.isResolved}
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                    isHighlighted 
                                      ? 'bg-pink-600 border-pink-500 text-white' 
                                      : 'bg-transparent border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-850'
                                  }`}
                                >
                                  {isHighlighted ? 'Đang ghim chiếu' : 'Ghim chiếu'}
                                </button>
                                <button 
                                  onClick={() => handleResolveQuestion(q.id, q.isResolved)}
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                    q.isResolved 
                                      ? 'bg-emerald-600 border-emerald-500 text-white' 
                                      : 'bg-transparent border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-850'
                                  }`}
                                >
                                  {q.isResolved ? 'Mở lại câu hỏi' : 'Đã giải quyết'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      <footer 
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        style={{
          transform: `translate(calc(-50% + ${menuPos.x}px), ${menuPos.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        className="fixed bottom-6 left-1/2 h-16 sm:h-20 flex items-center justify-center px-3.5 sm:px-6 rounded-full bg-gray-950/85 border border-gray-800/80 shadow-2xl backdrop-blur-xl z-40 gap-1.5 sm:gap-4 max-w-[96vw] overflow-x-auto select-none touch-auto transition-shadow duration-300 hover:shadow-purple-500/10 hover:border-purple-500/20 active:shadow-purple-500/20 active:border-purple-500/30"
      >
        {/* Chỉ báo cầm kéo (Draggable Handle indicator) */}
        <div className="flex flex-col gap-0.5 pr-2.5 cursor-grab active:cursor-grabbing select-none shrink-0 border-r border-gray-800 mr-0.5 opacity-40 hover:opacity-100 transition-opacity touch-none">
          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
        </div>

        <button onClick={toggleMic} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shadow-md ${micOn ? 'glass-button hover:bg-gray-800' : 'bg-red-500 text-white hover:bg-red-600'}`}>
          {micOn ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
        
        <button onClick={toggleVideo} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shadow-md ${videoOn ? 'glass-button hover:bg-gray-800' : 'bg-red-500 text-white hover:bg-red-600'}`}>
          {videoOn ? <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
        
        <button onClick={toggleScreenShare} className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shadow-md shrink-0 ${isScreenSharing ? 'bg-purple-600 text-white hover:bg-purple-500' : 'glass-button hover:bg-gray-800'}`} title="Chia sẻ màn hình">
          <MonitorUp className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
        </button>
        
        {/* Emoji Reactions Button */}
        <div className="relative">
          <button 
            onClick={() => setIsEmojiPanelOpen(!isEmojiPanelOpen)} 
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shadow-md ${isEmojiPanelOpen ? 'bg-yellow-500 text-white hover:bg-yellow-400' : 'glass-button hover:bg-gray-800'}`}
            title="Phản hồi cảm xúc"
          >
            <Smile className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </button>
          {isEmojiPanelOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex items-center gap-1 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl px-3 py-2 shadow-2xl animate-in zoom-in-95 duration-150">
              {['👍', '🎉', '❤️', '😮', '😂', '👏'].map(emoji => (
                <button 
                  key={emoji} 
                  onClick={() => sendEmojiReaction(emoji)}
                  className="text-2xl hover:scale-150 transition-transform duration-150 p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="w-px h-6 bg-gray-800 mx-0.5 sm:mx-1"></div>
        
        {/* Toggle Chat Button */}
        <button 
          onClick={() => { setIsChatOpen(!isChatOpen); setUnreadCount(0); }} 
          className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shadow-md ${isChatOpen ? 'bg-blue-600 text-white' : 'glass-button hover:bg-gray-800'}`}
          title="Trò chuyện"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute top-0 right-0 transform translate-x-1 -translate-y-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-gray-900 animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
 
        {/* Cài đặt thiết bị (Settings Button) */}
        <button 
          onClick={openSettings} 
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shadow-md glass-button hover:bg-gray-800 text-gray-300 hover:text-white"
          title="Cài đặt thiết bị"
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
 
        <div className="w-px h-6 bg-gray-800 mx-0.5 sm:mx-1"></div>
 
        <button onClick={handleLeave} className="px-3 sm:px-5 h-9 sm:h-11 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)]">
          <PhoneOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Rời phòng</span>
        </button>
      </footer>

      {/* Settings Modal (Cấu hình thiết bị) */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={closeSettings}
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

                {/* Thanh hiện nhịp Mic nhảy nhót real-time */}
                <div className="mt-2.5 flex items-center gap-2 bg-gray-950/40 p-2 rounded-lg border border-gray-800/50">
                  <div className="text-[11px] text-gray-400 font-medium whitespace-nowrap flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></div> Tín hiệu Mic:
                  </div>
                  <div className="flex-1 h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-800/80 flex items-center p-[1px]">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-green-500 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400 w-6 text-right">{micLevel}%</div>
                </div>
              </div>

              {/* Lọc tiếng ồn thông minh (Noise Suppression) */}
              <div className="flex items-center justify-between bg-gray-950/40 p-3 rounded-lg border border-gray-800/50">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-4 h-4 ${noiseSuppressionOn ? 'text-purple-400 animate-pulse' : 'text-gray-400'}`} />
                  <div>
                    <div className="text-xs font-semibold text-white">Lọc tiếng ồn AI</div>
                    <div className="text-[10px] text-gray-400">Loại bỏ tạp âm & cải thiện giọng nói</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={noiseSuppressionOn}
                    onChange={e => toggleNoiseFilter(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
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

              {/* Ảnh nền ảo & Làm mờ nền AI */}
              <div className="bg-gray-950/40 p-3 rounded-lg border border-gray-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Hiệu ứng nền AI</div>
                      <div className="text-[10px] text-gray-400">Thay đổi hoặc làm mờ nền của bạn</div>
                    </div>
                  </div>
                  {isVirtualBgLoading && (
                    <div className="text-[10px] text-indigo-400 animate-pulse font-medium">Đang tải AI...</div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => handleUpdateBackgroundEffect('none')}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                      virtualBg === 'none' 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Không có
                  </button>
                  <button 
                    onClick={() => handleUpdateBackgroundEffect('blur')}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                      virtualBg === 'blur' 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Mờ nền
                  </button>
                  <button 
                    onClick={() => handleUpdateBackgroundEffect('image')}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                      virtualBg === 'image' 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Ảnh nền
                  </button>
                </div>

                {virtualBg === 'image' && (
                  <div className="space-y-2 pt-1">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Chọn ảnh nền</div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {[
                        { name: 'Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=640&auto=format&fit=crop' },
                        { name: 'Study', url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=640&auto=format&fit=crop' },
                        { name: 'Living', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=640&auto=format&fit=crop' }
                      ].map((bg, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleUpdateBackgroundEffect('image', bg.url)}
                          className={`w-14 h-10 rounded-lg overflow-hidden border shrink-0 relative transition-all ${
                            selectedBgImage === bg.url ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-800 hover:border-gray-600'
                          }`}
                          title={bg.name}
                        >
                          <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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

              {/* Giao diện chọn Theme */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Giao diện cuộc gọi (Theme)
                </label>
                <select 
                  value={theme} 
                  onChange={e => setTheme(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="default">Classic Dark (Xanh tím tối)</option>
                  <option value="cyberpunk">Cyberpunk (Hồng & Cyan)</option>
                  <option value="sunset">Sunset Glow (Cam ấm hoàng hôn)</option>
                  <option value="emerald">Emerald Aurora (Xanh ngọc lấp lánh)</option>
                  <option value="ocean">Ocean Breeze (Xanh đại dương sâu)</option>
                  <option value="midnight">Midnight Pure (Đen tuyền OLED)</option>
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
