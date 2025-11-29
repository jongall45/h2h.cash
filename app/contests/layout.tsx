import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tournaments | h2h.cash",
  description: "Compete in NFL prop tournaments for cash prizes.",
};

// Force dynamic rendering for all contest pages
export const dynamic = 'force-dynamic';

export default function ContestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {children}
    </div>
  );
}

