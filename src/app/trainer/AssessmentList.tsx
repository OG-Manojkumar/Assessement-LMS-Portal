"use client";

import { useState } from "react";
import Link from "next/link";
import DeleteAssessmentButton from "./DeleteAssessmentButton";

export default function AssessmentList({ initialAssessments }: { initialAssessments: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredAndSorted = [...initialAssessments]
    .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.joinCode.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "titleAsc") return a.title.localeCompare(b.title);
      if (sortBy === "titleDesc") return b.title.localeCompare(a.title);
      if (sortBy === "studentsDesc") return b._count.students - a._count.students;
      return 0;
    });

  const handleCopyLink = (joinCode: string) => {
    const url = `${window.location.origin}/?code=${joinCode}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(joinCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>All Assessments</span>
            <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {filteredAndSorted.length}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage and monitor your online exams in real-time.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input 
              type="text" 
              placeholder="Search assessment or code..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50/50 transition"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sort:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="titleAsc">Title (A-Z)</option>
              <option value="titleDesc">Title (Z-A)</option>
              <option value="studentsDesc">Most Students</option>
            </select>
          </div>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 p-6">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {searchQuery ? "No matching assessments" : "No assessments created yet"}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            {searchQuery ? `No assessments match "${searchQuery}". Try clearing your search.` : "Create your first test by importing questions or creating custom coding questions."}
          </p>
          <Link 
            href="/trainer/question-bank" 
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5"
          >
            + Create Assessment Now
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile Responsive Cards (Visible on screens < md) */}
          <div className="md:hidden space-y-4">
            {filteredAndSorted.map(assessment => {
              const isOnline = assessment.status === 'PUBLISHED';
              return (
                <div key={assessment.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/trainer/assessment/${assessment.id}`} className="font-extrabold text-slate-900 text-base hover:text-indigo-600 transition block">
                        {assessment.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isOnline ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                          {isOnline ? 'Live Online' : 'Closed'}
                        </span>
                        <span className="text-xs font-medium text-slate-500">⏱️ {assessment.duration} mins</span>
                      </div>
                    </div>
                    <DeleteAssessmentButton assessmentId={assessment.id} assessmentTitle={assessment.title} />
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500">Join Code: </span>
                      <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {assessment.joinCode}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyLink(assessment.joinCode)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition underline"
                    >
                      {copiedCode === assessment.joinCode ? "✅ Copied!" : "Copy Link"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600 font-medium">
                    <span>📝 {assessment._count.questions} Questions</span>
                    <span>👥 {assessment._count.students} Students</span>
                    <Link 
                      href={`/trainer/assessment/${assessment.id}`}
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      Open &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (Hidden on screens < md) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm bg-white">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-gradient-to-r from-slate-50 via-slate-100/70 to-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Assessment Title</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Join Code</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Questions</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAndSorted.map(assessment => {
                  const isOnline = assessment.status === 'PUBLISHED';
                  return (
                    <tr key={assessment.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-medium">
                        <Link 
                          href={`/trainer/assessment/${assessment.id}`} 
                          className="font-bold text-slate-900 group-hover:text-indigo-600 transition flex items-center gap-2"
                        >
                          <span>{assessment.title}</span>
                          <span className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">&rarr;</span>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg shadow-xs">
                            {assessment.joinCode}
                          </span>
                          <button
                            onClick={() => handleCopyLink(assessment.joinCode)}
                            className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition"
                            title="Copy student invite link"
                          >
                            {copiedCode === assessment.joinCode ? "✅ Copied" : "Copy"}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                          {isOnline ? 'Live Active' : 'Closed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                        ⏱️ {assessment.duration} mins
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md text-xs font-bold">
                          📝 {assessment._count.questions} Qs
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-200/70">
                          👥 {assessment._count.students} Joined
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/trainer/assessment/${assessment.id}`}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition border border-indigo-200/70"
                          >
                            Manage
                          </Link>
                          <DeleteAssessmentButton assessmentId={assessment.id} assessmentTitle={assessment.title} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
