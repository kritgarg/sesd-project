"use client";

import { useState, useCallback, useRef } from "react";

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const addToast = useCallback((message, type = "info", duration = 3500) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);

    timersRef.current[id] = setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete timersRef.current[id];
      }, 300);
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    setToasts((prev) => prev.filter((t) => t.id !== id));
    delete timersRef.current[id];
  }, []);

  return { toasts, addToast, removeToast };
}

export function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none" style={{ fontFamily: 'var(--font-oswald), sans-serif' }}>
      {toasts.map((toast) => {
        const bgColor =
          toast.type === "success"
            ? "bg-[#FFE600]"
            : toast.type === "error"
            ? "bg-[#FF0055]"
            : "bg-[#FFE600]";

        const textColor = 
          toast.type === "success" ? "text-black" : "text-white";

        const icon =
          toast.type === "success"
            ? "✓"
            : toast.type === "error"
            ? "✕"
            : "ℹ";

        return (
          <div
            key={toast.id}
            onClick={() => onRemove(toast.id)}
            className={`pointer-events-auto cursor-pointer ${bgColor} ${textColor} px-6 py-4 rounded-xl border-4 border-[#121210] shadow-[4px_4px_0_#121210] flex items-center gap-4 text-xl font-bold uppercase tracking-wide max-w-[340px] transition-all duration-300 ${
              toast.exiting
                ? "opacity-0 translate-x-12"
                : "opacity-100 translate-x-0 animate-[slideIn_0.3s_ease-out]"
            } hover:translate-y-[-2px] hover:shadow-[6px_6px_0_#121210]`}
          >
            <span className="text-2xl shrink-0">{icon}</span>
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
