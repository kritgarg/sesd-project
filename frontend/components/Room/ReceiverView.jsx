function StatusDot({ isConnected, status }) {
  const color = isConnected
    ? "bg-green-500"
    : status.includes("❌")
    ? "bg-red-500"
    : "bg-[#FFE600] animate-pulse";

  return <span className={`w-3 h-3 rounded-full inline-block border-2 border-[#121210] ${color}`} />;
}

export default function ReceiverView({
  code,
  isConnected,
  status,
  recvProgress,
  recvSpeed,
  recvFileName,
}) {
  const isReceiving = recvProgress > 0;
  const isPeerLeft = status.includes("Peer left") || status.includes("Peer disconnected");

  if (isReceiving) {
    return (
      <div 
        className="bg-[#FFE600] rounded-[32px] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)] w-[360px] text-center border-4 border-[#121210] flex flex-col items-center"
        style={{ fontFamily: 'var(--font-oswald), sans-serif' }}
      >
        <p className="text-sm font-bold text-[#121210] mb-2 uppercase">Receiving</p>
        <h2 className="text-3xl font-bold text-[#121210] mb-1 truncate w-full uppercase tracking-tighter">
          {recvFileName}
        </h2>
        <p className="text-sm font-bold text-[#121210] mb-6 uppercase">
          {recvProgress.toFixed(0)}% · {recvSpeed.toFixed(1)} MB/s
        </p>
        <div className="w-full bg-[#121210] rounded-full h-8 overflow-hidden border-2 border-[#121210] relative">
          <div
            className="bg-[#FFE600] h-full transition-all duration-200 border-r-4 border-[#121210]"
            style={{ width: `${Math.min(recvProgress, 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-[#FFE600] rounded-[32px] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)] w-[360px] text-center border-4 border-[#121210] flex flex-col items-center"
      style={{ fontFamily: 'var(--font-oswald), sans-serif' }}
    >
      <h2 className="text-4xl font-bold mb-2 text-[#121210] uppercase tracking-tighter">
        SWIFTSHARE
      </h2>
      <p className="text-sm font-bold text-[#121210] mb-4 uppercase">
        Room: <span className="text-xl bg-[#121210] text-[#FFE600] px-2 py-1 rounded-md ml-2">{code}</span>
      </p>
      
      <div className="mt-4 flex flex-col justify-center items-center gap-2 pt-4 border-t-4 border-[#121210] text-[#121210] font-bold uppercase text-sm w-full">
        <div className="flex items-center gap-2">
          <StatusDot isConnected={isConnected} status={status} />
          {isConnected ? "Connected — Waiting for files" : status}
        </div>
      </div>

      {isPeerLeft && (
        <button
          onClick={() => window.location.reload()}
          className="mt-6 bg-[#121210] text-[#FFE600] px-6 py-3 rounded-full text-xl font-bold hover:scale-[1.05] active:scale-[0.98] transition-all duration-200 w-full cursor-pointer uppercase tracking-wide"
        >
          Reload to reconnect
        </button>
      )}

      <div className="mt-4 pt-2 text-[10px] text-[#121210] font-bold uppercase opacity-80 leading-tight">
        * Sender and receiver should be on the same WiFi for faster transfer. Please don't close this tab until files are shared.
      </div>
    </div>
  );
}
