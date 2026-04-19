import { QRCodeCanvas } from "qrcode.react";
import FileQueueUI from "./FileQueueUI";

function StatusDot({ isConnected, status }) {
  const color = isConnected
    ? "bg-green-500"
    : status.includes("❌")
    ? "bg-red-500"
    : "bg-[#FFE600] animate-pulse";

  return <span className={`w-3 h-3 rounded-full inline-block border-2 border-[#121210] ${color}`} />;
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
    <div 
      className="bg-[#FFE600] rounded-[32px] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)] w-[380px] text-center border-4 border-[#121210] flex flex-col relative"
      style={{ fontFamily: 'var(--font-oswald), sans-serif' }}
    >
      <h2 className="text-4xl font-bold mb-1 text-[#121210] uppercase tracking-tighter leading-none">
        {sessionState === STATES.COMPLETED
          ? "COMPLETED"
          : "READY TO SEND"}
      </h2>
      <p className="text-sm font-bold text-[#121210] mb-6 uppercase">
        {sessionState === STATES.COMPLETED
          ? "All files sent successfully"
          : "Share this link to start transfer"}
      </p>

      {sessionState !== STATES.COMPLETED && (
        <div className="flex flex-col items-center">
          <div className="flex justify-center mb-6 p-4 bg-[#121210] rounded-2xl">
            <QRCodeCanvas
              value={roomUrl || code}
              size={140}
              bgColor="#121210"
              fgColor="#FFE600"
            />
          </div>

          <div
            onClick={handleCopy}
            className="bg-[#121210] text-[#FFE600] p-3 rounded-xl text-xs mb-4 font-mono break-all font-bold cursor-pointer hover:bg-[#222] transition-colors duration-200 uppercase w-full"
            title="Click to copy"
          >
            {roomUrl || code}
          </div>

          <button
            onClick={handleCopy}
            className="bg-[#121210] text-[#FFE600] px-6 py-3 rounded-full text-xl font-bold hover:scale-[1.05] active:scale-[0.98] transition-all duration-200 w-full mb-4 cursor-pointer uppercase tracking-wide border-2 border-transparent"
          >
            Copy Link
          </button>
        </div>
      )}

      <div className="bg-[#121210] p-4 rounded-xl text-left border-2 border-transparent mt-2">
        <FileQueueUI stagedFiles={stagedFiles} currentFile={currentFile} />
      </div>

      {showFilePicker && (
        <div className="mt-4">
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
            className="w-full inline-block cursor-pointer bg-transparent border-[3px] border-[#121210] text-[#121210] px-6 py-3 rounded-full text-xl font-bold hover:bg-[#121210] hover:text-[#FFE600] transition-all duration-200 text-center uppercase tracking-wide"
          >
            Select More
          </label>
        </div>
      )}

      <div className="mt-6 flex justify-center items-center gap-2 pt-4 border-t-4 border-[#121210] text-[#121210] font-bold uppercase text-sm">
        <StatusDot isConnected={isConnected} status={status} />
        {statusMessage}
      </div>
    </div>
  );
}
