'use client';

interface ReauthDialogProps {
  isOpen: boolean;
  message: string;
  onReauth: () => void;
  onCancel: () => void;
}

export function ReauthDialog({ isOpen, message, onReauth, onCancel }: ReauthDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Re-authentication Required
        </h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <p className="text-sm text-gray-500 mb-6">
          This is a critical operation. For security, you must sign in again with Google before proceeding.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onReauth}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
