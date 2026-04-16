"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function Home() {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setStagedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (idx) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const totalSize = stagedFiles.reduce((a, f) => a + f.size, 0);

  const handleStart = async () => {
    if (stagedFiles.length === 0) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/room/create`
      );
      // Pass file references via sessionStorage (names only, files re-attached on room page)
      sessionStorage.setItem(
        "swiftshare_staged",
        JSON.stringify(stagedFiles.map((f) => f.name))
      );
      // Store actual File objects in a global so the room page can grab them
      window.__swiftshare_files = stagedFiles;
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
          <h1 className="text-xl font-semibold mb-2 text-[#0a0a0a]">
            SwiftShare
          </h1>
          <p className="text-xs text-[#6b6b6b]">
            Preparing secure connection...
          </p>
        </div>
      ) : (
        <div className="z-10 text-center max-w-md w-full">
          <h1 className="text-3xl font-semibold mb-2 text-[#0a0a0a]">
            SwiftShare
          </h1>
          <p className="text-[#6b6b6b] mb-8 text-base">
            Share files instantly. No uploads. No waiting.
          </p>

          <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-300 text-center">
            {stagedFiles.length === 0 ? (
              <>
                <p className="text-sm text-[#6b6b6b] mb-4">
                  Drop files here
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  id="landingFileInput"
                  onChange={handleFileSelect}
                />
                <label
                  htmlFor="landingFileInput"
                  className="cursor-pointer text-sm font-medium px-6 py-3 bg-[#111111] text-white rounded-full hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 inline-block"
                >
                  Select Files
                </label>
              </>
            ) : (
              <>
                <p className="text-sm text-[#6b6b6b] mb-1">
                  {stagedFiles.length} file
                  {stagedFiles.length > 1 ? "s" : ""} selected
                </p>
                <p className="text-xs text-[#6b6b6b] mb-4">
                  Total: {formatSize(totalSize)}
                </p>

                {/* File list */}
                <div className="space-y-2 mb-6 text-left max-h-[200px] overflow-y-auto">
                  {stagedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#f7f7f7]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0a0a0a] truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-[#6b6b6b]">
                          {formatSize(file.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-[#6b6b6b] hover:text-[#0a0a0a] text-xs ml-3 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleStart}
                    className="w-full text-sm font-medium px-6 py-3 bg-[#111111] text-white rounded-full hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
                  >
                    Start Sharing
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-sm font-medium px-6 py-2.5 bg-white text-[#6b6b6b] border border-[rgba(0,0,0,0.06)] rounded-full hover:bg-[#f7f7f7] transition-all duration-200"
                  >
                    Add more files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-[#6b6b6b] mt-6">
            Files never touch a server
          </p>
        </div>
      )}
    </div>
  );
}
