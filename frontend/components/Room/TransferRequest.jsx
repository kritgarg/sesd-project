export default function TransferRequest({ request, onAccept, onReject }) {
  if (!request) return null;

  return (
    <div className="fixed inset-0 bg-[#f7f7f7] flex items-center justify-center z-[100] px-4">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>
      
      <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl p-8 shadow-sm w-[340px] text-center z-10 transition-all duration-300 hover:shadow-md">
        <p className="text-sm text-[#6b6b6b] mb-2">Incoming file</p>
        <h2 className="text-lg font-medium text-[#0a0a0a] mb-1 truncate">{request.fileName}</h2>
        <p className="text-xs text-[#6b6b6b] mb-6">
          {(request.fileSize / 1024 / 1024).toFixed(2)} MB
        </p>

        <div className="flex flex-col gap-3">
          <button 
            onClick={onAccept}
            className="w-full bg-[#111111] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
          >
            Download
          </button>
          <button 
            onClick={onReject}
            className="w-full bg-white text-[#6b6b6b] border border-[rgba(0,0,0,0.06)] px-5 py-2.5 rounded-full text-sm font-medium hover:bg-[#f7f7f7] transition-all duration-200"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
