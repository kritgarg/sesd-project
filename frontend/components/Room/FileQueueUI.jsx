function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function FileQueueUI({ stagedFiles, currentFile }) {
  if (!stagedFiles || stagedFiles.length === 0) return null;

  return (
    <div className="w-full mt-6">
      <p className="text-xs text-[#6b6b6b] mb-3 font-medium">Transfer queue</p>
      <div className="space-y-2">
        {stagedFiles.map((file) => (
          <div
            key={file.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
              file.status === "sending"
                ? "border-[rgba(0,0,0,0.08)] bg-white"
                : file.status === "complete"
                ? "border-[rgba(0,0,0,0.04)] bg-gray-50"
                : file.status === "rejected"
                ? "border-[rgba(0,0,0,0.03)] bg-gray-50 opacity-40"
                : "border-[rgba(0,0,0,0.06)] bg-white"
            }`}
          >
            {/* Status dot */}
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                file.status === "sending"
                  ? "bg-[#111111] animate-pulse"
                  : file.status === "complete"
                  ? "bg-green-500"
                  : file.status === "rejected"
                  ? "bg-red-400"
                  : "bg-gray-300"
              }`}
            ></span>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0a0a0a] truncate">
                {file.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-[#6b6b6b]">
                <span>{formatSize(file.size)}</span>
                {file.status === "sending" && file.progress > 0 && (
                  <>
                    <span>·</span>
                    <span>{file.progress.toFixed(0)}%</span>
                    {file.speed > 0 && (
                      <>
                        <span>·</span>
                        <span>{file.speed.toFixed(1)} MB/s</span>
                      </>
                    )}
                  </>
                )}
                {file.status === "complete" && <span>· Done</span>}
                {file.status === "rejected" && <span>· Declined</span>}
              </div>

              {/* Per-file progress bar */}
              {file.status === "sending" && file.progress > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-1 mt-2 overflow-hidden">
                  <div
                    className="bg-[#111111] h-full rounded-full transition-all duration-200"
                    style={{ width: `${Math.min(file.progress, 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
