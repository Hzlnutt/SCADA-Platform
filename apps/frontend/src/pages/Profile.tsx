import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageHeader } from "../components/ui/PageHeader";
import { updateProfile } from "../services/auth.service";
import { useAuthStore } from "../store/auth.store";

const initialsFromName = (name?: string | null) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
};

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmAvatar, setConfirmAvatar] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  const initials = useMemo(() => initialsFromName(name), [name]);

  useEffect(() => {
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
  }, [user]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingAvatar(reader.result);
        setConfirmAvatar(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setMessage("Name cannot be empty.");
        setSaving(false);
        return;
      }

      const result = await updateProfile({
        name: trimmedName,
        avatarUrl: avatarUrl || null
      });
      updateUser(result.data);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmSave(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Settings"
        description="Manage user identity details and avatar picture."
      />
      <div className="rounded-2xl border border-slate-900 bg-slate-950/60 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-wrap items-center gap-5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="User avatar"
                className="h-20 w-20 rounded-full border border-[#acd3ff] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#acd3ff] bg-white text-lg font-semibold text-[#003b75]">
                {initials}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-slate-200">
                {user?.email ?? "user@widatra.co"}
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#acd3ff] px-3 py-1 text-xs text-[#003b75]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                Upload Photo
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-[#003b75]">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm focus:border-[#1f6fb5] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#003b75]">Access Role</label>
              <input
                type="text"
                value={user?.role ?? "user"}
                disabled
                className="mt-2 w-full rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-sm text-[#86a9cc]"
              />
            </div>
          </div>

          {message ? (
            <div className="rounded-xl border border-[#d6e9fb] bg-white px-4 py-3 text-xs text-[#47729f]">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1f6fb5] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#155c99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmSave}
        title="Confirm Profile Save"
        description="Are you sure you want to save your profile changes?"
        confirmText="Yes"
        cancelText="No"
        onConfirm={() => {
          setConfirmSave(false);
          saveProfile();
        }}
        onCancel={() => setConfirmSave(false)}
      />

      <ConfirmDialog
        open={confirmAvatar}
        title="Confirm Avatar Update"
        description="Do you want to use the newly selected profile photo?"
        confirmText="Yes"
        cancelText="No"
        onConfirm={() => {
          setConfirmAvatar(false);
          if (pendingAvatar) {
            setAvatarUrl(pendingAvatar);
            setPendingAvatar(null);
          }
        }}
        onCancel={() => {
          setConfirmAvatar(false);
          setPendingAvatar(null);
        }}
      />
    </div>
  );
}
