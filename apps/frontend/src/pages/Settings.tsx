import { PageHeader } from "../components/ui/PageHeader";

export default function Settings() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Roles, permissions, and system preferences."
      />
      <div className="rounded-2xl border border-slate-900 bg-slate-950/60 p-6 text-sm text-slate-300">
        Settings placeholder.
      </div>
    </div>
  );
}
