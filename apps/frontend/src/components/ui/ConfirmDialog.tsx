type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmText = "Ya",
  cancelText = "Tidak",
  onConfirm,
  onCancel
}: ConfirmDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#acd3ff] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="text-sm font-semibold text-[#002b5c]">{title}</div>
        {description ? (
          <div className="mt-2 text-xs text-[#47729f]">{description}</div>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#f5aa99] bg-[#ffe6df] px-4 py-1.5 text-xs font-semibold text-[#b42318]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-[#1f6fb5] px-4 py-1.5 text-xs font-semibold text-white"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
