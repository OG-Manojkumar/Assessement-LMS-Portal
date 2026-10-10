import Link from "next/link";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-extrabold text-blue-600 leading-tight">Besant Technologies<br/><span className="text-gray-800 text-lg">Mock Exams</span></h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/trainer"
            className="block p-3 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 font-medium transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/trainer/question-bank"
            className="block p-3 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 font-medium transition-colors"
          >
            Question Bank
          </Link>
          <Link
            href="/trainer/assessments"
            className="block p-3 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 font-medium transition-colors"
          >
            Assessments
          </Link>
        </nav>
        <div className="p-4 border-t">
          <div className="text-sm text-gray-500">Logged in as Trainer</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
