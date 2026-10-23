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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Colorful Hero Header */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-indigo-900/50">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-3 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Besant Technologies LMS
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Trainer Command Center
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-xl font-medium">
              Monitor active exams, view live attendance, review AI auto-gradings, and manage your question bank.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/trainer/question-bank"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>Create Assessment</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Vibrant KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Active Assessments */}
        <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-white border border-indigo-200/80 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-400 transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Live Online
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{activeAssessmentsCount}</div>
          <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mt-1.5">Active Assessments</div>
          <p className="text-xs text-slate-500 mt-1">Currently open for students to join</p>
        </div>

        {/* Total Questions */}
        <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border border-emerald-200/80 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-400 transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              MCQ + Coding
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{totalQuestions}</div>
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mt-1.5">Total Questions in Bank</div>
          <p className="text-xs text-slate-500 mt-1">Available for test generation</p>
        </div>

        {/* Students Evaluated */}
        <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-white border border-cyan-200/80 shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-400 transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Evaluated
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{totalStudents}</div>
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider mt-1.5">Total Submissions</div>
          <p className="text-xs text-slate-500 mt-1">Graded by AI &amp; auto-evaluator</p>
        </div>
      </div>

      {/* Assessment List Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm">
        <AssessmentList initialAssessments={recentAssessments} />
      </div>
    </div>
  );
}
