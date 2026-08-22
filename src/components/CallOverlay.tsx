import { useEffect, useRef, useState } from 'react';
import { PhoneOff, Phone, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui/Avatar';

export default function CallOverlay() {
  const { 
    activeCall, localStream, remoteStream, 
    acceptCall, declineCall, endCall, 
    toggleMute, toggleVideo, isMuted, isVideoOff,
    error, clearError
  } = useCall();
  
  const { currentUser } = useAuth();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  
  const [duration, setDuration] = useState(0);

  // Timer for active call
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeCall?.status === 'ongoing') {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  // Bind streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream, activeCall?.status]);

  // Ringtone synthesizer
  useEffect(() => {
    const isIncomingRinging = activeCall?.status === 'ringing' && activeCall.calleeId === currentUser?.uid;
    
    if (isIncomingRinging) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        
        const playRing = () => {
          if (ctx.state === 'closed') return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start();
          osc.stop(ctx.currentTime + 2);
          oscillatorRef.current = osc;
        };

        playRing();
        const interval = setInterval(playRing, 3000);
        
        return () => {
          clearInterval(interval);
          if (oscillatorRef.current) oscillatorRef.current.stop();
          ctx.close();
        };
      } catch (e) {
        console.error("Audio API error", e);
      }
    }
  }, [activeCall?.status, activeCall?.calleeId, currentUser?.uid]);

  if (error) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <span>{error}</span>
        <button onClick={clearError} className="hover:bg-red-600 rounded-full p-1"><X className="w-4 h-4"/></button>
      </div>
    );
  }

  if (!activeCall) return null;

  const isCaller = activeCall.callerId === currentUser?.uid;
  const isVideo = activeCall.type === 'video';
  const otherName = isCaller ? activeCall.calleeName : activeCall.callerName;
  const otherPhoto = isCaller ? activeCall.calleePhoto : activeCall.callerPhoto;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col overflow-hidden animate-in fade-in">
      
      {/* Remote Video Background (if ongoing video call) */}
      {activeCall.status === 'ongoing' && isVideo && (
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Foreground Content */}
      <div className="relative z-10 flex-1 flex flex-col p-6 pointer-events-none">
        
        {/* Header Info */}
        <div className="flex flex-col items-center mt-10">
          {(activeCall.status === 'ringing' || !isVideo) && (
            <Avatar 
              src={otherPhoto || 'https://api.dicebear.com/7.x/initials/svg?seed=U'} 
              alt="Avatar" 
              className={`w-32 h-32 mb-6 border-4 border-white/20 shadow-xl ${activeCall.status === 'ringing' ? 'animate-pulse' : ''}`}
            />
          )}
          <h2 className="text-3xl font-semibold drop-shadow-md">{otherName}</h2>
          
          <p className="text-white/80 mt-2 text-lg drop-shadow-md">
            {activeCall.status === 'ringing' && isCaller && 'Calling...'}
            {activeCall.status === 'ringing' && !isCaller && `Incoming ${isVideo ? 'Video' : 'Voice'} Call`}
            {activeCall.status === 'ongoing' && formatDuration(duration)}
          </p>
        </div>

        {/* PIP Local Video */}
        {activeCall.status === 'ongoing' && isVideo && (
          <div className="absolute top-6 right-6 w-32 h-48 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 pointer-events-auto">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1" />

        {/* Controls */}
        <div className="flex justify-center gap-6 mb-10 pointer-events-auto">
          
          {activeCall.status === 'ringing' && !isCaller && (
            <>
              <button 
                onClick={declineCall} 
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <button 
                onClick={acceptCall} 
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              >
                {isVideo ? <Video className="w-8 h-8 text-white" /> : <Phone className="w-8 h-8 text-white" />}
              </button>
            </>
          )}

          {(activeCall.status === 'ongoing' || (activeCall.status === 'ringing' && isCaller)) && (
            <button 
              onClick={endCall} 
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </button>
          )}

          {activeCall.status === 'ongoing' && (
            <>
              <button 
                onClick={toggleMute} 
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transition-colors ${isMuted ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-white'}`}
              >
                {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>
              
              {isVideo && (
                <button 
                  onClick={toggleVideo} 
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transition-colors ${isVideoOff ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                >
                  {isVideoOff ? <VideoOff className="w-7 h-7" /> : <Video className="w-7 h-7" />}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
