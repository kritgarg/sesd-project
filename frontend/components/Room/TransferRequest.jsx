import { useState } from "react";
import { motion } from "framer-motion";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function TransferRequest({ manifest, onAccept, onReject }) {
  const [selected, setSelected] = useState({});

  if (!manifest || !manifest.files || manifest.files.length === 0) return null;

  const allSelected =
    manifest.files.length > 0 &&
    manifest.files.every((f) => selected[f.id] !== false);

  const toggleFile = (id) => {
    setSelected((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }));
  };

  const toggleAll = () => {
    if (allSelected) {
      const off = {};
      manifest.files.forEach((f) => (off[f.id] = false));
      setSelected(off);
    } else {
      setSelected({});
    }
  };

  const totalSize = manifest.files.reduce((a, f) => a + f.size, 0);
  const selectedFiles = manifest.files.filter((f) => selected[f.id] !== false);

  const handleAccept = () => {
    onAccept(selectedFiles.map((f) => f.id));
  };

  return (
    <div 
      className="fixed inset-0 bg-[#000000]/80 flex items-center justify-center z-[100] px-4 backdrop-blur-sm"
      style={{ fontFamily: 'var(--font-oswald), sans-serif' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-[#FFE600] border-4 border-[#121210] rounded-[32px] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)] w-[400px] z-10 flex flex-col"
      >
        <p className="text-sm font-bold text-[#121210] mb-1 uppercase tracking-wider">Incoming Files</p>
        <h2 className="text-4xl font-bold text-[#121210] mb-1 uppercase tracking-tighter">
          {manifest.files.length} FILE{manifest.files.length > 1 ? "S" : ""}
        </h2>
        <p className="text-sm font-bold text-[#121210] mb-6 uppercase">
          Total: {formatSize(totalSize)}
        </p>

        <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto pr-1">
          {manifest.files.map((file) => {
            const isOn = selected[file.id] !== false;
            return (
              <motion.label
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                key={file.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-4 cursor-pointer transition-all duration-200 ${
                  isOn
                    ? "border-[#121210] bg-[#121210] text-[#FFE600]"
                    : "border-[#121210] bg-transparent text-[#121210] opacity-60 hover:opacity-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggleFile(file.id)}
                  className="accent-[#FFE600] w-5 h-5 border-2 border-[#121210] rounded-sm bg-[#121210]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold truncate uppercase tracking-tight">
                    {file.name}
                  </p>
                  <p className={`text-sm font-bold ${isOn ? 'text-[#FFE600]/80' : 'text-[#121210]/80'} uppercase`}>
                    {formatSize(file.size)}
                  </p>
                </div>
              </motion.label>
            );
          })}
        </div>

        <button
          onClick={toggleAll}
          className="text-sm font-bold text-[#121210] mb-4 hover:underline transition-colors uppercase self-start"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleAccept}
            disabled={selectedFiles.length === 0}
            className="w-full bg-[#121210] text-[#FFE600] px-5 py-3 rounded-full text-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wide border-4 border-[#121210]"
          >
            Accept {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
          </button>
          <button
            onClick={onReject}
            className="w-full bg-transparent text-[#121210] border-4 border-[#121210] px-5 py-3 rounded-full text-xl font-bold hover:bg-[#121210] hover:text-[#FFE600] transition-all duration-200 uppercase tracking-wide"
          >
            Decline All
          </button>
        </div>
      </motion.div>
    </div>
  );
}
