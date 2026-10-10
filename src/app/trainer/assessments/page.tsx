import { PrismaClient } from "@prisma/client";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function AssessmentsPage() {
  const assessments = await prisma.assessment.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, students: true } } }
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">All Assessments</h1>
          <p className="text-slate-500 mt-2 font-medium">Manage your published assessments and view results.</p>
        </div>
        <Link href="/trainer/question-bank" className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-sm transition-all transform hover:-translate-y-0.5">
          + Create New
        </Link>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Join Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students Taken</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assessments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No assessments found.
                </td>
              </tr>
            ) : (
              assessments.map((assessment) => (
                <tr key={assessment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">
                    <div className="flex items-center space-x-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${assessment.status === 'PUBLISHED' ? 'bg-green-500' : 'bg-red-500'}`} title={assessment.status === 'PUBLISHED' ? 'Active' : 'Closed'}></span>
                      <Link href={`/trainer/assessment/${assessment.id}`} className="text-blue-600 hover:underline">
                        {assessment.title}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                      {assessment.joinCode}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${assessment.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {assessment.status === 'PUBLISHED' ? 'Online' : 'Closed'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{assessment.duration} mins</td>
                  <td className="px-6 py-4 text-gray-500">{assessment._count.questions}</td>
                  <td className="px-6 py-4 text-gray-500">{assessment._count.students}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
