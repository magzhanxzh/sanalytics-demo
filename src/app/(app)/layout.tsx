import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen" style={{ gridTemplateColumns: "232px minmax(0,1fr)" }}>
      <Sidebar />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
