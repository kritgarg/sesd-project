import { QRCodeCanvas } from "qrcode.react";
import FileQueueUI from "./FileQueueUI";

function StatusDot({ isConnected, status }) {
  const color = isConnected
    ? "bg-green-500"
    : status.includes("❌")
    ? "bg-red-500"
    : "bg-yellow-500 animate-pulse";

  return <span className={`w-2 h-2 rounded-full inline-block ${color}`} />;
}

export default function SenderView({
  code,
  roomUrl,
  sessionState,
  STATES,
  stagedFiles,
  currentFile,
  stageFiles,
  isConnected,
  statusMessage,
  status,
  onToast,
}) {
  // Show picker when no files are pending/sending
  const pendingFiles = stagedFiles.filter(
    (f) => f.status === "staged" || f.status === "sending"
  );
  const showFilePicker =
    pendingFiles.length === 0 &&
    sessionState !== STATES.TRANSFERRING &&
    sessionState !== STATES.WAITING_FOR_PEER;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomUrl || code);
    onToast?.("Link copied!", "success", 2000);
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm w-[380px] text-center border border-[rgba(0,0,0,0.06)] hover:shadow-md transition-all duration-300">
      <h2 className="text-lg font-semibold mb-1 text-[#0a0a0a]">
        {sessionState === STATES.COMPLETED
          ? "Transfer complete"
          : "Your link is ready"}
      </h2>
      <p className="text-xs text-[#6b6b6b] mb-6">
        {sessionState === STATES.COMPLETED
          ? "All files sent successfully"
          : "Share this link to start transfer"}
      </p>

      {sessionState !== STATES.COMPLETED && (
        <>
          <div className="flex justify-center mb-6">
            <QRCodeCanvas
              value={roomUrl || code}
              size={140}
              bgColor="#ffffff"
              fgColor="#111111"
            />
          </div>

          <div
            onClick={handleCopy}
            className="bg-[#f7f7f7] p-3 rounded-lg text-xs mb-4 text-[#6b6b6b] font-mono break-all border border-[rgba(0,0,0,0.06)] cursor-pointer hover:bg-[#f0f0f0] transition-colors duration-200"
            title="Click to copy"
          >
            {roomUrl || code}
          </div>

          <button
            onClick={handleCopy}
            className="bg-[#111111] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 w-full mb-4 cursor-pointer"
          >
            Copy Link
          </button>
        </>
      )}

      <FileQueueUI stagedFiles={stagedFiles} currentFile={currentFile} />

      {showFilePicker && (
        <>
          <p className="text-sm text-[#6b6b6b] mt-4 mb-3">
            {sessionState === STATES.COMPLETED
              ? "Send more files?"
              : "Select files to send"}
          </p>
          <input
            type="file"
            multiple
            className="hidden"
            id="senderFileInput"
            onChange={(e) => {
              stageFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <label
            htmlFor="senderFileInput"
            className="w-full inline-block cursor-pointer bg-[#111111] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 text-center"
          >
            Select Files
          </label>
        </>
      )}

      <p className="text-xs text-[#6b6b6b] mt-6 flex justify-center items-center gap-2 pt-4 border-t border-[rgba(0,0,0,0.06)]">
        <StatusDot isConnected={isConnected} status={status} />
        {statusMessage}
      </p>
    </div>
  );
}
