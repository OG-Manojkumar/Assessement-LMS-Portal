import Sidebar from "./Sidebar";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar />
      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto">{children}</main>
    </div>
  );
}
