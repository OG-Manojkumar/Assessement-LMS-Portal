import { PrismaClient } from "@prisma/client";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function TrainerDashboard() {
  const activeAssessmentsCount = await prisma.assessment.count();
  const totalQuestions = await prisma.question.count();
  const totalStudents = await prisma.student.count();

  const recentAssessments = await prisma.assessment.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, students: true } } }
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">Welcome back! Here is an overview of your assessments.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-medium text-gray-500">Active Assessments</h3>
          <p className="text-3xl font-bold mt-2 text-blue-600">{activeAssessmentsCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-medium text-gray-500">Total Questions</h3>
          <p className="text-3xl font-bold mt-2 text-blue-600">{totalQuestions}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-medium text-gray-500">Total Students Evaluated</h3>
          <p className="text-3xl font-bold mt-2 text-blue-600">{totalStudents}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Assessments</h2>
          <Link href="/trainer/question-bank" className="text-blue-600 font-medium hover:underline">
            + Create New
          </Link>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Join Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Questions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentAssessments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No assessments created yet.
                  </td>
                </tr>
              ) : (
                recentAssessments.map(assessment => (
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
    </div>
  );
}
