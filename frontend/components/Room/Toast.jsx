"use client";

import { useState, useCallback, useRef } from "react";

let toastId = 0;

/**
 * Lightweight toast hook — no dependencies.
 * Types: "success" | "error" | "info"
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const addToast = useCallback((message, type = "info", duration = 3500) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);

    // Start exit animation, then remove
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

/**
 * Toast container — render once at the page level.
 */
export function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => {
        const bgColor =
          toast.type === "success"
            ? "bg-[#0a0a0a]"
            : toast.type === "error"
            ? "bg-red-600"
            : "bg-[#333333]";

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
            className={`pointer-events-auto cursor-pointer ${bgColor} text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 text-sm font-medium max-w-[340px] transition-all duration-300 ${
              toast.exiting
                ? "opacity-0 translate-x-8"
                : "opacity-100 translate-x-0 animate-[slideIn_0.3s_ease-out]"
            }`}
          >
            <span className="text-base shrink-0">{icon}</span>
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
