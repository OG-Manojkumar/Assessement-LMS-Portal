"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AssessmentResults({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudentResult, setSelectedStudentResult] = useState<any>(null);
  const [sortBy, setSortBy] = useState("scoreDesc");
  
  // Edit State
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchAssessment = async () => {
    try {
      // Create a new API route to fetch by ID, or reuse the one by Join Code
      const res = await fetch(`/api/assessments/details/${id}`);
      const data = await res.json();
      if (data.assessment) {
        setAssessment(data.assessment);
        setEditTitle(data.assessment.title);
        setEditDuration(data.assessment.duration.toString());
        setEditStatus(data.assessment.status);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessment();
  }, [id]);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/assessments/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: editTitle,
          duration: editDuration,
          status: editStatus
        })
      });
      if (res.ok) {
        await fetchAssessment(); // Refresh data
        setShowEditModal(false);
      } else {
        alert("Failed to update");
      }
    } catch (err) {
      console.error(err);
    }
    setIsSaving(false);
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!assessment) return <div className="p-8">Assessment not found.</div>;

  const maxScore = assessment.questions.reduce((total: any, q: any) => total + q.marks, 0);

  const sortedResults = [...(assessment.results || [])].sort((a: any, b: any) => {
    if (sortBy === "scoreDesc") return b.score - a.score;
    if (sortBy === "scoreAsc") return a.score - b.score;
    if (sortBy === "nameAsc") return a.student.name.localeCompare(b.student.name);
    if (sortBy === "dateNew") return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    if (sortBy === "dateOld") return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    if (sortBy === "malpractice") {
      const vA = JSON.parse(a.details).meta?.violations || 0;
      const vB = JSON.parse(b.details).meta?.violations || 0;
      return vB - vA; // Highest violations first
    }
    return 0;
  });

  const handleDownloadCSV = () => {
    if (!sortedResults.length) return;
    
    const headers = ["Student Name", "Email", "Mobile", "Score", "Total Marks", "Malpractice Violations", "Date Taken"];
    const rows = sortedResults.map((result: any) => {
      const details = JSON.parse(result.details);
      const violations = details.meta?.violations || 0;
      return [
        `"${result.student.name}"`,
        `"${result.student.email}"`,
        `"${result.student.mobile}"`,
        result.score,
        maxScore,
        violations,
        `"${new Date(result.completedAt).toLocaleString()}"`
      ];
    });
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${assessment.title.replace(/\s+/g, '_')}_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/trainer" className="text-blue-600 hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-gray-900">{assessment.title}</h1>
            <span className={`px-2 py-1 text-xs font-bold rounded ${assessment.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {assessment.status}
            </span>
          </div>
          <p className="text-gray-500 mt-1">
            Join Code: <span className="font-mono font-bold text-gray-900">{assessment.joinCode}</span> 
            <button 
              onClick={() => {
                const url = `${window.location.origin}/?code=${assessment.joinCode}`;
                navigator.clipboard.writeText(url);
                alert("Invite link copied to clipboard!");
              }}
              className="ml-2 text-blue-600 hover:text-blue-800 text-sm font-medium underline"
            >
              (Copy Invite Link)
            </button>
            {' '}| Duration: {assessment.duration} mins | Total Marks: {maxScore}
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleDownloadCSV}
            className="bg-green-600 border border-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            Export to Excel
          </button>
          <button 
            onClick={() => setShowEditModal(true)}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            Edit Settings
          </button>
        </div>
      </header>

      <div className="mb-4 flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Student Results ({sortedResults.length})</h2>
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="scoreDesc">Highest Score</option>
            <option value="scoreAsc">Lowest Score</option>
            <option value="nameAsc">Student Name (A-Z)</option>
            <option value="malpractice">Malpractice Violations</option>
            <option value="dateNew">Recently Completed</option>
            <option value="dateOld">Oldest Completed</option>
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malpractice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Taken</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedResults.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No students have taken this assessment yet.
                </td>
              </tr>
            ) : (
              sortedResults.map((result: any) => {
                const details = JSON.parse(result.details);
                const violations = details.meta?.violations || 0;
                return (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{result.student.name}</td>
                    <td className="px-6 py-4 text-gray-500">{result.student.email}</td>
                    <td className="px-6 py-4 text-gray-500">{result.student.mobile}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-blue-600">{result.score}</span> <span className="text-gray-400">/ {maxScore}</span>
                    </td>
                    <td className="px-6 py-4">
                      {violations > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {violations} Tab Switches
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Clean
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(result.completedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <button onClick={() => setSelectedStudentResult({ ...result, parsedDetails: details })} className="text-blue-600 hover:text-blue-900">
                        View Answers
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Edit Assessment Settings</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Title</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Duration (Minutes)</label>
                <input 
                  type="number" 
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Status</label>
                <select 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="PUBLISHED">Published (Active)</option>
                  <option value="DRAFT">Draft (Closed)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdate}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStudentResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedStudentResult.student.name}'s Answers</h2>
                <p className="text-gray-500 text-sm mt-1">Score: {selectedStudentResult.score} / {maxScore}</p>
              </div>
              <button 
                onClick={() => setSelectedStudentResult(null)}
                className="text-gray-500 hover:text-gray-800 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {assessment.questions.map((q: any, index: number) => {
                const res = selectedStudentResult.parsedDetails[q.id] || { studentAnswer: "No Answer", isCorrect: false, awardedMarks: 0, feedback: "" };
                return (
                  <div key={q.id} className={`bg-white p-6 rounded-xl border ${res.isCorrect ? 'border-green-300' : 'border-red-300'} shadow-sm`}>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-medium text-gray-900 font-bold">Q{index + 1}. {q.text}</h3>
                      <span className={`px-3 py-1 rounded text-sm font-bold ${res.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {res.awardedMarks} / {q.marks} Marks
                      </span>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">Student's Answer:</p>
                      {q.type === 'CODING' ? (
                        <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto text-gray-800">{res.studentAnswer || "No code submitted."}</pre>
                      ) : (
                        <div className="font-medium text-gray-900">{res.studentAnswer || "No answer selected."}</div>
                      )}
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">Correct Answer / Reference:</p>
                      <div className="font-medium text-green-700 bg-green-50 p-2 rounded">{q.correctAnswer}</div>
                    </div>

                    {q.type === 'CODING' && res.feedback && (
                      <div className="bg-blue-50 p-4 rounded-md">
                        <p className="text-sm font-bold text-blue-800 mb-1">AI Feedback:</p>
                        <p className="text-sm text-blue-900">{res.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
