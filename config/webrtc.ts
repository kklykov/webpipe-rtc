// Configuración para la conexión WebRTC
export function createPeerConnection(iceServers?: RTCIceServer[]) {
  const pc = new RTCPeerConnection({
    iceServers: iceServers ?? [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "ac8b270d08d94f6250f1098b",
        credential: "RsgtEEhJW2JA3AX7",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "ac8b270d08d94f6250f1098b",
        credential: "RsgtEEhJW2JA3AX7",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: "ac8b270d08d94f6250f1098b",
        credential: "RsgtEEhJW2JA3AX7",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: "ac8b270d08d94f6250f1098b",
        credential: "RsgtEEhJW2JA3AX7",
      },
    ],
    iceCandidatePoolSize: 10,
  });

  // Monitorear todos los eventos ICE
  pc.onicegatheringstatechange = () => {
    console.log(`Estado de recolección ICE: ${pc.iceGatheringState}`);
  };

  pc.onicecandidateerror = (event) => {
    console.warn("Error en candidato ICE:", event);
  };

  return pc;
}
