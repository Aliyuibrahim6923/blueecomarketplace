export function ContentPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-bold text-ocean-950">{title}</h1>
      {intro ? <p className="mt-3 text-lg text-muted-foreground">{intro}</p> : null}
      <div className="prose-page mt-6">{children}</div>
    </div>
  );
}

export function DraftNotice() {
  return (
    <div className="mb-6 rounded-md bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
      <strong>Draft for legal review.</strong> This page is a working draft prepared for the pilot. It must be reviewed by
      qualified Nigerian legal and data-protection advisers, and the legal operator named, before public launch.
    </div>
  );
}
