function StatusDot({ isConnected, status }) {
  const color = isConnected
    ? "bg-green-500"
    : status.includes("❌")
    ? "bg-red-500"
    : "bg-yellow-500 animate-pulse";

  return <span className={`w-2 h-2 rounded-full inline-block ${color}`} />;
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
      <div className="bg-white rounded-2xl p-8 shadow-sm w-[360px] text-center border border-[rgba(0,0,0,0.06)]">
        <p className="text-sm text-[#6b6b6b] mb-2">Receiving</p>
        <h2 className="text-lg font-semibold text-[#0a0a0a] mb-1 truncate">
          {recvFileName}
        </h2>
        <p className="text-xs text-[#6b6b6b] mb-4">
          {recvProgress.toFixed(0)}% · {recvSpeed.toFixed(1)} MB/s
        </p>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-[rgba(0,0,0,0.06)]">
          <div
            className="bg-[#111111] h-full rounded-full transition-all duration-200"
            style={{ width: `${Math.min(recvProgress, 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm w-[360px] text-center border border-[rgba(0,0,0,0.06)]">
      <h2 className="text-lg font-semibold mb-2 text-[#0a0a0a]">
        SwiftShare
      </h2>
      <p className="text-sm text-[#6b6b6b] mb-1">
        Room: <span className="font-mono text-[#0a0a0a]">{code}</span>
      </p>
      <p className="text-xs text-[#6b6b6b] mt-4 flex justify-center items-center gap-2">
        <StatusDot isConnected={isConnected} status={status} />
        {isConnected ? "Connected — waiting for files..." : status}
      </p>

      {/* Reload hint when peer disconnects */}
      {isPeerLeft && (
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-xs text-[#0a0a0a] bg-[#f7f7f7] border border-[rgba(0,0,0,0.06)] px-4 py-2 rounded-full hover:bg-[#ebebeb] transition-colors duration-200 cursor-pointer"
        >
          Reload to reconnect
        </button>
      )}
    </div>
  );
}
