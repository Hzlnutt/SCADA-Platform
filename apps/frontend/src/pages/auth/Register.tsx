import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleAuthButton } from "../../components/auth/GoogleAuthButton";
import { fetchGoogleConfig, loginWithGoogle, register } from "../../services/auth.service";
import { useAuthStore } from "../../store/auth.store";

export default function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""
  );

  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await register({ name, email, password });
      setSession(result);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrasi gagal");
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
      navigate("/", { replace: true });
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
          Create Account
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Registrasi Operator</h2>
        <p className="mt-2 text-sm text-[#47729f]">
          Buat akun untuk mengakses dashboard PLC dan P&ID.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#003b75]">Nama Lengkap</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm focus:border-[#1f6fb5] focus:outline-none"
            placeholder="Nama operator"
            required
          />
        </div>
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
        <div>
          <label className="text-xs font-semibold text-[#003b75]">Konfirmasi Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm focus:border-[#1f6fb5] focus:outline-none"
            placeholder="Ulangi password"
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
          {submitting ? "Memproses..." : "Daftar"}
        </button>
      </form>

      <div className="text-center text-sm text-[#47729f]">
        Sudah punya akun?{" "}
        <Link to="/login" className="font-semibold text-[#1f6fb5]">
          Masuk
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#d6e9fb]" />
        <span className="text-xs text-[#86a9cc]">atau</span>
        <div className="h-px flex-1 bg-[#d6e9fb]" />
      </div>

      <GoogleAuthButton
        clientId={googleClientId}
        onCredential={handleGoogle}
      />
    </div>
  );
}
