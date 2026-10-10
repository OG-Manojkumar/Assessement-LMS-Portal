"use client";

import { useState } from "react";
import Link from "next/link";
import DeleteAssessmentButton from "./DeleteAssessmentButton";

export default function AssessmentList({ initialAssessments }: { initialAssessments: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

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

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 space-y-4 md:space-y-0">
        <h2 className="text-xl font-bold text-gray-900">All Assessments ({filteredAndSorted.length})</h2>
        <div className="flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-4">
          <input 
            type="text" 
            placeholder="Search title or join code..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-1.5 text-sm text-gray-900 focus:ring-blue-500 outline-none bg-white w-64"
          />
          <div className="flex items-center space-x-2 border-l border-gray-200 pl-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="titleAsc">Title (A-Z)</option>
              <option value="titleDesc">Title (Z-A)</option>
              <option value="studentsDesc">Most Students</option>
            </select>
          </div>
          <Link href="/trainer/question-bank" className="bg-blue-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 transition ml-2 whitespace-nowrap">
            + Create New
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mt-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Title & Status</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Join Code</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Questions</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Students</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? "No assessments found matching your search." : "No assessments created yet."}
                </td>
              </tr>
            ) : (
              filteredAndSorted.map(assessment => (
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
                  <td className="px-6 py-4">
                    <DeleteAssessmentButton assessmentId={assessment.id} assessmentTitle={assessment.title} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
