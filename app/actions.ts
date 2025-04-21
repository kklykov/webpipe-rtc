"use server";

import { db } from "@/config/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

export async function getIceServers() {
  const response = await fetch(
    "https://webpipe.metered.live/api/v1/turn/credentials?apiKey=70e09a2938b48731186fc26810d56f48d98e"
  );

  // Saving the response in the iceServers array
  const iceServers = await response.json();

  return iceServers;
}

export async function createRoom(offer: RTCSessionDescriptionInit) {
  const roomRef = doc(collection(db, "rooms"));

  const roomWithOffer = {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
  };

  await setDoc(roomRef, roomWithOffer);

  return {
    roomId: roomRef.id,
    roomPath: roomRef.path,
  };
}

export async function fetchOffer(roomId: string) {
  const roomRef = doc(collection(db, "rooms"), roomId);
  const roomSnapshot = await getDoc(roomRef);

  if (!roomSnapshot.exists()) {
    throw new Error("Room not found");
  }

  const data = roomSnapshot.data();
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
    },
    { merge: true }
  );
}

export async function checkRoom(roomId: string) {
  const roomRef = doc(collection(db, "rooms"), roomId);
  const roomSnapshot = await getDoc(roomRef);

  if (!roomSnapshot.exists()) {
    return { exists: false };
  }

  return {
    exists: true,
    hasAnswer: !!roomSnapshot.data().answer,
  };
}

export async function saveIceCandidate(
  roomId: string,
  candidate: RTCIceCandidateInit,
  isCaller: boolean
) {
  const candidatesRef = collection(
    db,
    "rooms",
    roomId,
    isCaller ? "callerCandidates" : "calleeCandidates"
  );

  await addDoc(candidatesRef, {
    ...candidate,
    timestamp: Date.now(),
  });
}

export async function getRemoteIceCandidates(
  roomId: string,
  isCaller: boolean
) {
  const remoteCandidatesRef = collection(
    db,
    "rooms",
    roomId,
    isCaller ? "calleeCandidates" : "callerCandidates"
  );

  const snapshot = await getDocs(remoteCandidatesRef);

  // Añadimos metadata antes de devolver los candidatos
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      _id: doc.id,
    } as RTCIceCandidateInit & { _id: string };
  });
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

export async function checkStatus(roomId: string) {
  const roomRef = doc(collection(db, "rooms"), roomId);
  const roomSnapshot = await getDoc(roomRef);

  if (!roomSnapshot.exists()) {
    return { exists: false };
  }

  const data = roomSnapshot.data();
  return {
    exists: true,
    hasOffer: !!data.offer,
    hasAnswer: !!data.answer,
    callerCandidatesCount: await countIceCandidates(roomId, true),
    calleeCandidatesCount: await countIceCandidates(roomId, false),
  };
}

async function countIceCandidates(roomId: string, isCaller: boolean) {
  const candidatesRef = collection(
    db,
    "rooms",
    roomId,
    isCaller ? "callerCandidates" : "calleeCandidates"
  );

  const snapshot = await getDocs(candidatesRef);
  return snapshot.size;
}
