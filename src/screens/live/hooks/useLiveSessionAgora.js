import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  AudienceLatencyLevelType,
} from 'react-native-agora';
import { agora as agoraConfig } from '../../../config';
import { fetchAgoraToken, requestMediaPermissions } from '../liveSessionUtils';

const AGORA_APP_ID = agoraConfig.appId;

/**
 * Attach audience broadcast video listeners (shared init + post-consult rejoin).
 */
function attachBroadcastVideoListeners(engine, hostUid, ctx) {
  const { getCanceled, setBroadcastUid, setRemoteVideoLive, setPhase } = ctx;

  engine.addListener('onUserJoined', (_conn, uid) => {
    console.log('[Agora] onUserJoined uid:', uid, 'hostUid:', hostUid);
    if (!getCanceled() && uid === hostUid) setBroadcastUid(uid);
  });
  engine.addListener('onUserOffline', (_conn, uid) => {
    console.log('[Agora] onUserOffline uid:', uid);
    if (!getCanceled() && uid === hostUid) {
      setBroadcastUid(null);
      setRemoteVideoLive(false);
    }
  });
  engine.addListener('onJoinChannelSuccess', () => {
    console.log('[Agora] onJoinChannelSuccess — setting broadcastUid to', hostUid);
    if (!getCanceled()) {
      setBroadcastUid(hostUid);
      setPhase('broadcast');
      setTimeout(() => {
        if (!getCanceled()) setRemoteVideoLive(true);
      }, 4000);
    }
  });
  engine.addListener('onFirstRemoteVideoDecoded', (_conn, uid) => {
    console.log('[Agora] onFirstRemoteVideoDecoded uid:', uid);
    if (!getCanceled() && uid === hostUid) {
      setRemoteVideoLive(true);
    }
  });
  engine.addListener('onRemoteVideoStateChanged', (_conn, uid, state) => {
    if (!getCanceled() && uid === hostUid) {
      setRemoteVideoLive(state === 2);
    }
  });
}

export default function useLiveSessionAgora(session, isFocused) {
  const engineRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [broadcastUid, setBroadcastUid] = useState(null);
  const [consultRemoteUid, setConsultRemoteUid] = useState(null);
  const [agoraError, setAgoraError] = useState(null);
  const [remoteVideoLive, setRemoteVideoLive] = useState(false);
  const [agoraRestartKey, setAgoraRestartKey] = useState(0);
  const [localPreviewReady, setLocalPreviewReady] = useState(false);
  const backgroundedAtRef = useRef(null);

  const bumpRestart = useCallback(() => {
    setAgoraRestartKey((k) => k + 1);
  }, []);

  const cleanupEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.leaveChannel();
      engineRef.current.release();
      engineRef.current = null;
    }
    setBroadcastUid(null);
    setConsultRemoteUid(null);
  }, []);

  const endConsultation = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      await engine.leaveChannel();
      engine.removeAllListeners();

      engine.setClientRole(ClientRoleType.ClientRoleAudience, {
        audienceLatencyLevel: AudienceLatencyLevelType.AudienceLatencyLevelUltraLowLatency,
      });
      engine.disableVideo();
      engine.enableVideo();

      const hostUid = session?.hostUid ?? 1;
      setRemoteVideoLive(false);

      const ctx = {
        getCanceled: () => false,
        setBroadcastUid,
        setRemoteVideoLive,
        setPhase,
      };
      attachBroadcastVideoListeners(engine, hostUid, ctx);

      const rejoinToken = await fetchAgoraToken(session?.agoraChannel);
      await engine.joinChannel(rejoinToken, session?.agoraChannel, 0, {
        clientRoleType: ClientRoleType.ClientRoleAudience,
        audienceLatencyLevel: AudienceLatencyLevelType.AudienceLatencyLevelUltraLowLatency,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      });
    } catch (e) {
      console.error('End consultation error:', e);
      setPhase('broadcast');
    }
    setConsultRemoteUid(null);
    setLocalPreviewReady(false);
  }, [session?.agoraChannel, session?.hostUid, cleanupEngine]);

  useEffect(() => {
    if (!isFocused || !session?.agoraChannel || !AGORA_APP_ID) return;
    let didCancel = false;
    const getCanceled = () => didCancel;

    const init = async () => {
      setPhase('connecting');
      setAgoraError(null);
      setRemoteVideoLive(false);
      try {
        const engine = createAgoraRtcEngine();
        engineRef.current = engine;

        engine.initialize({
          appId: AGORA_APP_ID,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
        });

        engine.setClientRole(ClientRoleType.ClientRoleAudience, {
          audienceLatencyLevel: AudienceLatencyLevelType.AudienceLatencyLevelUltraLowLatency,
        });
        engine.enableVideo();
        engine.enableAudio();

        const hostUid = session.hostUid ?? 1;

        const ctx = {
          getCanceled,
          setBroadcastUid,
          setRemoteVideoLive,
          setPhase,
        };
        attachBroadcastVideoListeners(engine, hostUid, ctx);

        engine.addListener('onConnectionStateChanged', (_conn, state, reason) => {
          if (didCancel) return;
          console.log(`Agora connection: state=${state} reason=${reason}`);
          if (state === 5) {
            setAgoraError('Connection lost — reconnecting…');
            cleanupEngine();
            setAgoraRestartKey((k) => k + 1);
          }
        });

        engine.addListener('onError', (err) => {
          console.warn('Agora error:', err);
          if (!didCancel) setAgoraError(`Connection error (${err})`);
        });

        const broadcastToken = await fetchAgoraToken(session.agoraChannel);
        await engine.joinChannel(broadcastToken, session.agoraChannel, 0, {
          clientRoleType: ClientRoleType.ClientRoleAudience,
          audienceLatencyLevel: AudienceLatencyLevelType.AudienceLatencyLevelUltraLowLatency,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
        });
      } catch (e) {
        console.error('Agora init error:', e);
        if (!didCancel) setAgoraError('Could not connect to live stream.');
      }
    };

    init();

    return () => {
      didCancel = true;
      cleanupEngine();
      setPhase('idle');
      setRemoteVideoLive(false);
    };
  }, [session?.agoraChannel, isFocused, agoraRestartKey, cleanupEngine]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current = Date.now();
        if (engineRef.current) {
          engineRef.current.muteAllRemoteAudioStreams(true);
          engineRef.current.muteAllRemoteVideoStreams(true);
        }
      } else if (nextState === 'active') {
        const elapsedBg = backgroundedAtRef.current ? Date.now() - backgroundedAtRef.current : 0;
        backgroundedAtRef.current = null;

        if (elapsedBg > 5000) {
          cleanupEngine();
          setPhase('idle');
          setRemoteVideoLive(false);
          bumpRestart();
        } else if (engineRef.current) {
          engineRef.current.muteAllRemoteAudioStreams(false);
          engineRef.current.muteAllRemoteVideoStreams(false);
        }
      }
    });
    return () => sub.remove();
  }, [cleanupEngine, bumpRestart]);

  const joinConsultation = useCallback(async () => {
    if (!session || !AGORA_APP_ID) return;
    const ok = await requestMediaPermissions();
    if (!ok) {
      Alert.alert(
        'Permissions required',
        'Camera and microphone access are needed for the consultation.',
      );
      return;
    }

    const privateChannel = `${session.agoraChannel}-pvt`;
    const engine = engineRef.current;
    if (!engine) return;

    setPhase('consultation');
    setConsultRemoteUid(null);

    try {
      await engine.leaveChannel();
      engine.removeAllListeners();

      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      engine.enableVideo();
      engine.enableAudio();
      await engine.startPreview();

      engine.addListener('onUserJoined', (_conn, uid) => {
        setConsultRemoteUid(uid);
      });
      engine.addListener('onUserOffline', () => {
        setConsultRemoteUid(null);
      });
      engine.addListener('onError', (err) => {
        console.warn('Agora consult error:', err);
      });

      const consultToken = await fetchAgoraToken(privateChannel);
      await engine.joinChannel(consultToken, privateChannel, 0, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });
      setLocalPreviewReady(true);
    } catch (e) {
      console.error('Consultation join error:', e);
      Alert.alert('Error', 'Could not join the consultation. Please try again.');
      setPhase('broadcast');
    }
  }, [session]);

  return {
    phase,
    setPhase,
    broadcastUid,
    consultRemoteUid,
    agoraError,
    remoteVideoLive,
    localPreviewReady,
    joinConsultation,
    endConsultation,
  };
}
