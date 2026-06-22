import { useEffect, useRef } from "react";

type GoogleAuthButtonProps = {
  clientId: string;
  onCredential: (credential: string) => void;
  onReady?: () => void;
};

export const GoogleAuthButton = ({
  clientId,
  onCredential,
  onReady
}: GoogleAuthButtonProps) => {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;

    let intervalId: number | undefined;

    const initializeGoogleButton = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return false;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            onCredential(response.credential);
          }
        }
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with"
      });

      onReady?.();
      return true;
    };

    const succeeded = initializeGoogleButton();
    if (!succeeded) {
      intervalId = window.setInterval(() => {
        const ok = initializeGoogleButton();
        if (ok) {
          window.clearInterval(intervalId);
        }
      }, 100);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [clientId, onCredential, onReady]);

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-full border border-[#d6e9fb] bg-white px-4 py-3 text-sm text-[#86a9cc]"
      >
        Google OAuth belum dikonfigurasi
      </button>
    );
  }

  return <div ref={buttonRef} className="flex w-full justify-center" />;
};
