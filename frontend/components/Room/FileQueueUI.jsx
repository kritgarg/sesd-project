export default function FileQueueUI({ currentFile, queueRaw }) {
  if (!currentFile && (!queueRaw || queueRaw.length === 0)) return null;

  return (
    <div className="w-full bg-neutral-900/40 backdrop-blur-3xl border border-white/10 p-5 rounded-2xl shadow-xl mt-4">
      <h3 className="text-sm font-bold tracking-widest uppercase text-neutral-400 mb-3 border-b border-white/10 pb-2">Transmission Queue</h3>
      <div className="space-y-3">
        {currentFile && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl gap-2">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              <span className="font-semibold text-indigo-300 truncate max-w-[200px]">{currentFile.name}</span>
            </div>
            <span className="text-xs font-mono text-indigo-400 sm:text-right">ACTIVELY STREAMING</span>
          </div>
        )}
        
        {queueRaw && queueRaw.map((file, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl opacity-60 gap-2">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
              <span className="font-medium text-neutral-300 truncate max-w-[200px]">{file.name}</span>
            </div>
            <span className="text-xs font-mono text-neutral-500 sm:text-right">QUEUED</span>
          </div>
        ))}
      </div>
    </div>
  );
}
