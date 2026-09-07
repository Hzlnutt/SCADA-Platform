import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { login } from "../../services/auth.service";
import { useAuthStore } from "../../store/auth.store";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: Location } | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  useEffect(() => {
    if (accessToken) {
      navigate(redirectTo, { replace: true });
    }
  }, [accessToken, navigate, redirectTo]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(username, password);
      setSession(result);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
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
          Sign in to monitor PLC telemetry, historian graphs, and shift logs.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#003b75]">Username</label>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm focus:border-[#1f6fb5] focus:outline-none"
            placeholder="Masukkan username"
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#003b75]">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm focus:border-[#1f6fb5] focus:outline-none"
            placeholder="Masukkan password"
            required
            autoComplete="current-password"
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
          {submitting ? "Processing..." : "Sign In"}
        </button>
      </form>

      <div className="text-center text-xs text-[#47729f]">
        Self-registration is disabled. Please contact your system administrator to register.
      </div>
    </div>
  );
}
