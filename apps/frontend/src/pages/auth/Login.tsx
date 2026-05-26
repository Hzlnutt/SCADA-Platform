import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, type Location } from "react-router-dom";
import { GoogleAuthButton } from "../../components/auth/GoogleAuthButton";
import { fetchGoogleConfig, login, loginWithGoogle } from "../../services/auth.service";
import { useAuthStore } from "../../store/auth.store";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""
  );

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: Location } | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  useEffect(() => {
    if (accessToken) {
      navigate(redirectTo, { replace: true });
    }
  }, [accessToken, navigate, redirectTo]);

  useEffect(() => {
    let active = true;
    fetchGoogleConfig()
      .then((result) => {
        if (active && result.clientId) {
          setGoogleClientId(result.clientId);
        }
      })
      .catch(() => {
        // fallback to env client id if backend is unreachable
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      setSession(result);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await loginWithGoogle(credential);
      setSession(result);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login gagal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-[#1f6fb5]">
          Secure Access
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Welcome back</h2>
        <p className="mt-2 text-sm text-[#47729f]">
          Masuk untuk memonitor PLC, historian, dan laporan shift.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#003b75]">Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm focus:border-[#1f6fb5] focus:outline-none"
            placeholder="operator@widatra.co"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#003b75]">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm focus:border-[#1f6fb5] focus:outline-none"
            placeholder="Minimum 8 karakter"
            required
          />
        </div>
        {error ? (
          <div className="rounded-xl border border-[#f5aa99] bg-[#ffe6df] px-4 py-3 text-xs text-[#b42318]">
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-[#1f6fb5] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#155c99] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#d6e9fb]" />
        <span className="text-xs text-[#86a9cc]">atau</span>
        <div className="h-px flex-1 bg-[#d6e9fb]" />
      </div>

      <GoogleAuthButton
        clientId={googleClientId}
        onCredential={handleGoogle}
      />

      <div className="text-center text-sm text-[#47729f]">
        Belum punya akun?{" "}
        <Link to="/register" className="font-semibold text-[#1f6fb5]">
          Daftar
        </Link>
      </div>
    </div>
  );
}
