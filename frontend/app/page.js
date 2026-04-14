"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/room/create`);
      router.push(`/room/${res.data.code}`);
    } catch (e) {
      console.error("Failed to create room", e);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>

      {loading ? (
        <div className="z-10 text-center animate-pulse">
          <h1 className="text-xl font-semibold mb-2 text-[#0a0a0a]">SwiftShare</h1>
          <p className="text-xs text-[#6b6b6b]">Preparing secure connection...</p>
        </div>
      ) : (
        <div className="z-10 text-center max-w-md">
          <h1 className="text-3xl font-semibold mb-2 text-[#0a0a0a]">SwiftShare</h1>
          <p className="text-[#6b6b6b] mb-8 text-base">
            Share files instantly. No uploads. No waiting.
          </p>

          <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl p-10 shadow-sm hover:shadow-md transition-all duration-300">
            <p className="text-sm text-[#6b6b6b] mb-4">Create a secure P2P session</p>
            <button
              onClick={handleCreateRoom}
              className="cursor-pointer text-sm font-medium px-6 py-3 bg-[#111111] text-white rounded-full hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
            >
              Start Sharing
            </button>
          </div>

          <p className="text-xs text-[#6b6b6b] mt-6">Files never touch a server</p>
        </div>
      )}
    </div>
  );
}
