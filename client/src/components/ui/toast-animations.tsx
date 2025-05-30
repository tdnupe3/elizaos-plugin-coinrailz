import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export function EnhancedToast({ id, type, title, description, duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div
      className={cn(
        "max-w-sm w-full shadow-lg rounded-lg border p-4 transition-all duration-300 transform",
        getBgColor(),
        isVisible && !isExiting ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-95",
        isExiting && "translate-x-full opacity-0 scale-95"
      )}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={handleClose}
            className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onClose }: { 
  toasts: Array<Omit<ToastProps, 'onClose'>>;
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <EnhancedToast
          key={toast.id}
          {...toast}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

export function useToastSystem() {
  const [toasts, setToasts] = useState<Array<Omit<ToastProps, 'onClose'>>>([]);

  const addToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (title: string, description?: string) => {
    addToast({ type: 'success', title, description });
  };

  const showError = (title: string, description?: string) => {
    addToast({ type: 'error', title, description });
  };

  const showInfo = (title: string, description?: string) => {
    addToast({ type: 'info', title, description });
  };

  const showWarning = (title: string, description?: string) => {
    addToast({ type: 'warning', title, description });
  };

  return {
    toasts,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    ToastContainer: ({ className }: { className?: string }) => (
      <div className={className}>
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </div>
    )
  };
}