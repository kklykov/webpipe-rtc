"use server";

import { db } from "@/config/firebase";
import { ICECandidateWithId, RoomStatus } from "@/types/webrtc";
import { getCandidatesCollection } from "@/utils/webrtcHelpers";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

// Configuración de ICE servers
const ICE_SERVERS_API_URL =
  "https://webpipe.metered.live/api/v1/turn/credentials?apiKey=70e09a2938b48731186fc26810d56f48d98e";

export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const response = await fetch(ICE_SERVERS_API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn("Error fetching ICE servers:", error);
    // Fallback a servidores STUN públicos
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
  }
}

// Operaciones de sala
export async function createRoom(
  offer: RTCSessionDescriptionInit,
  roomId: string
) {
  const roomRef = doc(db, "rooms", roomId);

  // Check if room already exists
  const existingRoom = await getDoc(roomRef);
  if (existingRoom.exists()) {
    throw new Error(`Room ${roomId} already exists`);
  }

  await setDoc(roomRef, {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
    createdAt: Date.now(),
  });

  return {
    roomId,
    roomPath: roomRef.path,
  };
}

export async function fetchOffer(roomId: string) {
  const roomRef = doc(collection(db, "rooms"), roomId);
  const roomSnapshot = await getDoc(roomRef);

  if (!roomSnapshot.exists()) {
    throw new Error(`Room ${roomId} not found`);
  }

  const data = roomSnapshot.data();
  if (!data.offer) {
    throw new Error(`No offer found in room ${roomId}`);
  }

  return {
    offer: data.offer,
    roomId,
  };
}

export async function saveAnswer(
  roomId: string,
  answer: RTCSessionDescriptionInit
) {
  const roomRef = doc(collection(db, "rooms"), roomId);

  await setDoc(
    roomRef,
    {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
      answeredAt: Date.now(),
    },
    { merge: true }
  );
}

export async function getRemoteAnswer(roomId: string) {
  const roomRef = doc(collection(db, "rooms"), roomId);
  const roomSnapshot = await getDoc(roomRef);

  if (!roomSnapshot.exists()) {
    return null;
  }

  const data = roomSnapshot.data();
  return data.answer || null;
}

// Operaciones de candidatos ICE
export async function saveIceCandidate(
  roomId: string,
  candidate: RTCIceCandidateInit,
  isCaller: boolean
) {
  const candidatesRef = collection(
    db,
    "rooms",
    roomId,
    getCandidatesCollection(isCaller)
  );

  await addDoc(candidatesRef, {
    ...candidate,
    timestamp: Date.now(),
  });
}

export async function getRemoteIceCandidates(
  roomId: string,
  isCaller: boolean
): Promise<ICECandidateWithId[]> {
  const remoteCandidatesRef = collection(
    db,
    "rooms",
    roomId,
    getCandidatesCollection(isCaller, true)
  );

  const snapshot = await getDocs(remoteCandidatesRef);

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    _id: doc.id,
  })) as ICECandidateWithId[];
}

// Operaciones de estado
export async function checkStatus(roomId: string): Promise<RoomStatus> {
  const roomRef = doc(collection(db, "rooms"), roomId);
  const roomSnapshot = await getDoc(roomRef);

  if (!roomSnapshot.exists()) {
    return { exists: false };
  }

  const data = roomSnapshot.data();
  const [callerCount, calleeCount] = await Promise.all([
    countIceCandidates(roomId, true),
    countIceCandidates(roomId, false),
  ]);

  return {
    exists: true,
    hasOffer: !!data.offer,
    hasAnswer: !!data.answer,
    callerCandidatesCount: callerCount,
    calleeCandidatesCount: calleeCount,
  };
}

// Función auxiliar para contar candidatos
async function countIceCandidates(
  roomId: string,
  isCaller: boolean
): Promise<number> {
  const candidatesRef = collection(
    db,
    "rooms",
    roomId,
    getCandidatesCollection(isCaller)
  );

  const snapshot = await getDocs(candidatesRef);
  return snapshot.size;
}

// Función legacy para compatibilidad (se puede eliminar si no se usa)
export async function checkRoom(roomId: string) {
  const status = await checkStatus(roomId);
  return {
    exists: status.exists,
    hasAnswer: status.hasAnswer,
  };
}
