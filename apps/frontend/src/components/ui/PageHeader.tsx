type PageHeaderProps = {
  title: string;
  description?: string;
};

export const PageHeader = ({ title, description }: PageHeaderProps) => {
  return (
    <div className="mb-5">
      <div className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#1f6fb5]">
        Executive Overview
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#002b5c]">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-sm text-[#47729f]">{description}</p>
      ) : null}
    </div>
  );
};
