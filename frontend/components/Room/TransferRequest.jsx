export default function TransferRequest({ request, onAccept, onReject }) {
  if (!request) return null;

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
      <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
           <span className="text-2xl animate-bounce mt-1">📥</span>
        </div>
        
        <h2 className="text-2xl font-black mb-2 text-white">Incoming File</h2>
        <p className="text-neutral-400 mb-6 font-medium text-sm">
          Your peer is requesting to send a file.
        </p>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
          <p className="font-semibold text-indigo-300 truncate mb-1">{request.fileName}</p>
          <p className="text-xs text-neutral-500 font-mono">{(request.fileSize / 1024 / 1024).toFixed(2)} MB • {request.fileType || 'Unknown Type'}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={onReject}
            className="flex-1 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl font-bold text-red-400 transition-all active:scale-95"
          >
            Reject
          </button>
          <button 
            onClick={onAccept}
            className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl font-bold shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all active:scale-95"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
