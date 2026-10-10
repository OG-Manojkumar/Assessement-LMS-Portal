import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import AssessmentList from "./AssessmentList";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export default async function TrainerDashboard() {
  const activeAssessmentsCount = await prisma.assessment.count({ where: { status: "PUBLISHED" } });
  const totalQuestions = await prisma.question.count();
  const totalStudents = await prisma.student.count();

  // Fetch all assessments instead of just 5 so the user can search and sort them
  const recentAssessments = await prisma.assessment.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, students: true } } }
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-2 font-medium">Welcome back! Here is an overview of your assessments.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Assessments</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 mt-2">{activeAssessmentsCount}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Questions</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 mt-2">{totalQuestions}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Students Evaluated</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 mt-2">{totalStudents}</p>
        </div>
      </div>

      <AssessmentList initialAssessments={recentAssessments} />
    </div>
  );
}
