type StatCardProps = {
  title: string;
  value: string;
  detail?: string;
};

export const StatCard = ({ title, value, detail }: StatCardProps) => {
  return (
    <div className="rounded-lg border border-[#acd3ff] bg-white p-4 shadow-[0_10px_28px_rgba(31,111,181,0.08)]">
      <div className="text-xs uppercase tracking-[0.2em] text-[#1f6fb5]">
        {title}
      </div>
      <div className="mt-2 text-xl font-semibold text-[#002b5c]">
        {value}
      </div>
      {detail ? (
        <div className="mt-2 text-xs text-[#47729f]">{detail}</div>
      ) : null}
    </div>
  );
};
