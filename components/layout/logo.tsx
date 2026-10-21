import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-bold text-ocean-900 ${className}`} aria-label="BlueMarket Nigeria home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0b3654" />
        <path d="M5 19c3.2-2.6 6.4-2.6 9.6 0s6.4 2.6 9.6 0" stroke="#0e9488" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M5 13c3.2-2.6 6.4-2.6 9.6 0s6.4 2.6 9.6 0" stroke="#a9d0e7" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="25" cy="8" r="2" fill="#e8603f" />
      </svg>
      <span className="text-lg leading-none">
        BlueMarket <span className="font-medium text-teal-600">Nigeria</span>
      </span>
    </Link>
  );
}
