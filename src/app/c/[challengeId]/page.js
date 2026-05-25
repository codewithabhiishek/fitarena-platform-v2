"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function ChallengeLanding() {
  const { challengeId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!challengeId) {
      router.replace("/");
      return;
    }
    sessionStorage.setItem("fitarena_open_challenge", JSON.stringify({
      id: challengeId,
      expiresAt: Number(searchParams.get("expires")),
      token: searchParams.get("token") || "",
    }));
    router.replace("/");
  }, [challengeId, router, searchParams]);

  return (
    <div style={{
      minHeight:"100vh", background:"#0a0a0a",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      gap:16, color:"#f0f0f0", fontFamily:"sans-serif"
    }}>
      <div style={{ fontSize:48 }}>⚡</div>
      <div style={{ fontSize:22,fontWeight:900,color:"#39FF14" }}>FitArena</div>
      <div style={{ fontSize:14,color:"#555" }}>Opening challenge...</div>
    </div>
  );
}
