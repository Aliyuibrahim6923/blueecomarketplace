import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ocean-50">
      <header className="container-page py-6">
        <Logo />
      </header>
      <main id="main" className="container-page flex flex-1 items-start justify-center pb-16">
        <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
