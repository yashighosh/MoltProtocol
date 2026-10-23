import { createContext, useCallback, useContext, useState } from "react";

type ToastItem = { id: number; text: string };
const ToastContext = createContext<(text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, text }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((item) => <div key={item.id} className="toast" role="status">{item.text}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
