"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function Home() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createRoom = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/room/create`);
      router.push(`/room/${res.data.code}`);
    } catch (e) {
      console.error("Failed to create room", e);
      setLoading(false);
    }
  };

  const joinRoom = () => {
    if (!code) return;
    router.push(`/room/${code}`);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-6 overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="z-10 bg-neutral-900/60 backdrop-blur-3xl border border-white/10 p-10 rounded-[2rem] shadow-2xl w-full max-w-md">
        
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-tr from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent mb-3">
            SwiftShare
          </h1>
          <p className="text-neutral-400 font-medium">Lightning fast peer-to-peer sharing</p>
        </div>

        <div className="space-y-6">
          <button 
            onClick={createRoom}
            disabled={loading}
            className="w-full group relative flex justify-center py-4 px-4 font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] disabled:opacity-50"
          >
            {loading ? "Initializing Secure Room..." : "Create New Room"}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-700/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent backdrop-blur-lg text-neutral-500 font-medium">or join existing</span>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              placeholder="Enter Room Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="block w-full px-5 py-4 bg-neutral-950/50 border border-neutral-700/80 rounded-2xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 uppercase font-mono tracking-wider"
            />
            <button 
              onClick={joinRoom}
              disabled={!code}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/5 text-white font-bold rounded-2xl transition-all duration-200 disabled:opacity-30 disabled:hover:bg-white/10"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
