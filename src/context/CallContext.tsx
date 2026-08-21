import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, setDoc, updateDoc, onSnapshot, query, where, addDoc 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import CallOverlay from '../components/CallOverlay';

// Type definitions
export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'ongoing' | 'ended' | 'declined' | 'missed' | 'busy';

export interface CallData {
  id: string;
  callerId: string;
  calleeId: string;
  callerName: string;
  callerPhoto: string;
  calleeName: string;
  calleePhoto: string;
  type: CallType;
  status: CallStatus;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: number;
  endedAt?: number;
  conversationId: string;
}

interface CallContextType {
  activeCall: CallData | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  initiateCall: (calleeId: string, calleeName: string, calleePhoto: string, type: CallType, conversationId: string) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  error: string | null;
  clearError: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const [activeCall, setActiveCall] = useState<CallData | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callDocRef = useRef<string | null>(null);
  
  // Timers and cleanup refs
  const missedCallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);
  
  // Keep track of activeCall in a ref for event handlers
  const activeCallRef = useRef<CallData | null>(null);
  activeCallRef.current = activeCall;

  // Cleanup function for peer connection and media
  const cleanupCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (missedCallTimer.current) clearTimeout(missedCallTimer.current);
    if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
    
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    callDocRef.current = null;
    candidateQueue.current = [];
    setIsMuted(false);
    setIsVideoOff(false);
  }, []);

  // Global incoming call listener
  useEffect(() => {
    if (!currentUser) return;
    
    const callsQuery = query(
      collection(db, 'calls'),
      where('calleeId', '==', currentUser.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const callData = { id: change.doc.id, ...change.doc.data() } as CallData;
          
          // Simultaneous call edge case: if we are already in a call (or ringing)
          if (activeCallRef.current) {
            // We're busy! Auto-decline.
            updateDoc(doc(db, 'calls', callData.id), { status: 'busy', endedAt: Date.now() });
            return;
          }
          
          // Accept incoming call state
          callDocRef.current = callData.id;
          setActiveCall(callData);
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Listener for active call document changes (both sides)
  useEffect(() => {
    if (!callDocRef.current) return;
    
    const unsubscribe = onSnapshot(doc(db, 'calls', callDocRef.current), async (snapshot) => {
      if (!snapshot.exists()) {
        cleanupCall();
        return;
      }
      
      const data = { id: snapshot.id, ...snapshot.data() } as CallData;
      setActiveCall(data);
      
      const isCaller = data.callerId === currentUser?.uid;

      // Handle Missed / Declined / Busy / Ended
      if (['ended', 'declined', 'missed', 'busy'].includes(data.status)) {
        if (missedCallTimer.current) clearTimeout(missedCallTimer.current);
        
        // Log to chat history if it just ended (and we are the caller or callee, though caller is safer to avoid duplicate writes)
        // Actually, let's write it only once per call. We'll have the caller write it if possible, or whoever initiates the end state.
        // If it's a missed call, the caller writes it. If declined, the callee wrote 'declined', we can write log then.
        // To simplify, we'll let whoever actively triggers the final state write the log in that function, NOT in the snapshot listener to avoid duplicates.
        
        // But what if the OTHER person ends it? The listener picks it up.
        cleanupCall();
        return;
      }

      // Handle Answer arriving for the Caller
      if (isCaller && data.status === 'ongoing' && data.answer && pcRef.current?.signalingState === 'have-local-offer') {
        if (missedCallTimer.current) clearTimeout(missedCallTimer.current);
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          // Process queued candidates
          candidateQueue.current.forEach(cand => pcRef.current?.addIceCandidate(new RTCIceCandidate(cand)));
          candidateQueue.current = [];
        } catch (err) {
          console.error("Error setting remote description from answer:", err);
        }
      }
    });

    return () => unsubscribe();
  }, [cleanupCall, currentUser?.uid]);

  // ICE Candidates Listener
  useEffect(() => {
    if (!callDocRef.current || !activeCall) return;
    const isCaller = activeCall.callerId === currentUser?.uid;
    const candidatesCollection = isCaller ? 'calleeCandidates' : 'callerCandidates';
    
    const unsubscribe = onSnapshot(
      collection(db, `calls/${callDocRef.current}/${candidatesCollection}`),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = change.doc.data() as RTCIceCandidateInit;
            if (pcRef.current?.remoteDescription) {
              pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            } else {
              // Queue candidate until remote desc is set
              candidateQueue.current.push(candidate);
            }
          }
        });
      }
    );
    return () => unsubscribe();
  }, [activeCall, currentUser?.uid]);

  const writeCallLog = async (call: CallData, finalStatus: CallStatus, durationSecs: number = 0) => {
    if (!call.conversationId || !currentUser) return;
    try {
      await addDoc(collection(db, `conversations/${call.conversationId}/messages`), {
        type: 'call',
        senderId: call.callerId, // Always the caller is the sender of the "call log" message
        callType: call.type,
        callStatus: finalStatus,
        duration: durationSecs,
        timestamp: Date.now(),
        readBy: [currentUser.uid]
      });
      // Update last message
      await updateDoc(doc(db, 'conversations', call.conversationId), {
        lastMessage: `📞 ${call.type === 'video' ? 'Video' : 'Voice'} call`,
        lastMessageTimestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed to write call log:", err);
    }
  };

  const setupPeerConnection = (callId: string, isCaller: boolean) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    
    const candidatesCollection = isCaller ? 'callerCandidates' : 'calleeCandidates';

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, `calls/${callId}/${candidatesCollection}`), event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') {
        if (!disconnectTimer.current) {
          disconnectTimer.current = setTimeout(() => {
            setError("Call ended - connection lost");
            endCall();
          }, 10000);
        }
      } else if (state === 'connected' || state === 'completed') {
        if (disconnectTimer.current) {
          clearTimeout(disconnectTimer.current);
          disconnectTimer.current = null;
        }
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    return pc;
  };

  const initiateCall = async (calleeId: string, calleeName: string, calleePhoto: string, type: CallType, conversationId: string) => {
    if (!currentUser || !userProfile) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoOff(false);

      const callDoc = doc(collection(db, 'calls'));
      callDocRef.current = callDoc.id;

      const pc = setupPeerConnection(callDoc.id, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callData: CallData = {
        id: callDoc.id,
        callerId: currentUser.uid,
        calleeId,
        callerName: userProfile.displayName,
        callerPhoto: userProfile.photoURL || '',
        calleeName,
        calleePhoto,
        type,
        status: 'ringing',
        offer: { type: offer.type, sdp: offer.sdp },
        createdAt: Date.now(),
        conversationId
      };

      await setDoc(callDoc, callData);
      setActiveCall(callData);

      // Missed call timeout
      missedCallTimer.current = setTimeout(() => {
        if (activeCallRef.current?.status === 'ringing') {
          updateDoc(doc(db, 'calls', callDoc.id), { status: 'missed', endedAt: Date.now() });
          writeCallLog(activeCallRef.current, 'missed');
          cleanupCall();
        }
      }, 40000);

    } catch (err: any) {
      console.error("Failed to initiate call:", err);
      let errorMsg = "Camera/Mic access denied — please enable in browser settings.";
      if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found')) {
        errorMsg = `Could not find a ${type === 'video' ? 'camera or microphone' : 'microphone'}.`;
      } else if (!navigator.mediaDevices) {
        errorMsg = "Your browser does not support media devices or is not in a secure context (HTTPS/localhost).";
      }
      setError(errorMsg);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    const call = activeCallRef.current;
    if (!call || !callDocRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.type === 'video' });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoOff(false);

      const pc = setupPeerConnection(call.id, false);
      if (call.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
        // Process queued candidates
        candidateQueue.current.forEach(cand => pc.addIceCandidate(new RTCIceCandidate(cand)));
        candidateQueue.current = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await updateDoc(doc(db, 'calls', call.id), {
        answer: { type: answer.type, sdp: answer.sdp },
        status: 'ongoing'
      });
      
      // Update local state early to switch UI
      setActiveCall({ ...call, status: 'ongoing', answer: { type: answer.type, sdp: answer.sdp }});

    } catch (err: any) {
      console.error("Failed to accept call:", err);
      let errorMsg = "Camera/Mic access denied.";
      if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found')) {
        errorMsg = `Could not find a ${call.type === 'video' ? 'camera or microphone' : 'microphone'}.`;
      }
      setError(errorMsg);
      declineCall();
    }
  };

  const declineCall = () => {
    const call = activeCallRef.current;
    if (call && callDocRef.current) {
      updateDoc(doc(db, 'calls', call.id), { status: 'declined', endedAt: Date.now() });
      if (call.callerId === currentUser?.uid) {
        // Caller cancelled
        writeCallLog(call, 'ended');
      } else {
        // Callee declined
        writeCallLog(call, 'declined');
      }
    }
    cleanupCall();
  };

  const endCall = () => {
    const call = activeCallRef.current;
    if (call && callDocRef.current && call.status === 'ongoing') {
      const duration = Math.floor((Date.now() - call.createdAt) / 1000);
      updateDoc(doc(db, 'calls', call.id), { status: 'ended', endedAt: Date.now() });
      writeCallLog(call, 'ended', duration);
    } else if (call && call.status === 'ringing') {
      // Caller hung up before answer
      updateDoc(doc(db, 'calls', call.id), { status: 'ended', endedAt: Date.now() });
      writeCallLog(call, 'ended');
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const clearError = () => setError(null);

  return (
    <CallContext.Provider value={{
      activeCall, localStream, remoteStream, 
      initiateCall, acceptCall, declineCall, endCall, 
      toggleMute, toggleVideo, isMuted, isVideoOff,
      error, clearError
    }}>
      {children}
      <CallOverlay />
    </CallContext.Provider>
  );
};
