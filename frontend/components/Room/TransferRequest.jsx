import { useState } from "react";

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
    setSelected((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
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
    const ids = selectedFiles.map((f) => f.id);
    onAccept(ids);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100] px-4">
      <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-2xl p-8 shadow-md w-[380px] z-10 transition-all duration-300">

        <p className="text-sm text-[#6b6b6b] mb-1">Incoming files</p>
        <h2 className="text-lg font-semibold text-[#0a0a0a] mb-1">
          {manifest.files.length} file{manifest.files.length > 1 ? "s" : ""}
        </h2>
        <p className="text-xs text-[#6b6b6b] mb-6">
          Total: {formatSize(totalSize)}
        </p>

        {/* File list */}
        <div className="space-y-2 mb-6 max-h-[240px] overflow-y-auto">
          {manifest.files.map((file) => {
            const isOn = selected[file.id] !== false;
            return (
              <label
                key={file.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                  isOn
                    ? "border-[rgba(0,0,0,0.06)] bg-white"
                    : "border-[rgba(0,0,0,0.03)] bg-gray-50 opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggleFile(file.id)}
                  className="accent-[#111111] w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#6b6b6b]">
                    {formatSize(file.size)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Select all toggle */}
        <button
          onClick={toggleAll}
          className="text-xs text-[#6b6b6b] mb-4 hover:text-[#0a0a0a] transition-colors"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleAccept}
            disabled={selectedFiles.length === 0}
            className="w-full bg-[#111111] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Accept {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
          </button>
          <button
            onClick={onReject}
            className="w-full bg-white text-[#6b6b6b] border border-[rgba(0,0,0,0.06)] px-5 py-2.5 rounded-full text-sm font-medium hover:bg-[#f7f7f7] transition-all duration-200"
          >
            Decline all
          </button>
        </div>
      </div>
    </div>
  );
}
