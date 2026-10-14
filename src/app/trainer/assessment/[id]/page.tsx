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
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [selectedStudentResult, setSelectedStudentResult] = useState<any>(null);
  const [sortBy, setSortBy] = useState("dateNew");
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit State
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);

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

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAssessment();
    const interval = setInterval(fetchAssessment, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const handleResumeAction = async (studentId: string, action: "APPROVE" | "REJECT" | "RESET") => {
    setActionLoading(prev => ({ ...prev, [studentId]: true }));
    try {
      const res = await fetch("/api/assessments/resume-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, action })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAssessment();
      } else {
        alert("Action failed: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setActionLoading(prev => ({ ...prev, [studentId]: false }));
  };

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

  const handleRegradeAssessment = async (onlyFailed = true) => {
    setIsRegrading(true);
    try {
      const res = await fetch("/api/results/regrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: id, onlyFailed })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAssessment();
        alert(`Successfully re-evaluated ${data.updatedCount} student submission(s) with AI!`);
      } else {
        alert("Failed to re-evaluate: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error re-evaluating submissions.");
    }
    setIsRegrading(false);
  };

  const handleRegradeStudent = async (resultId: string) => {
    setIsRegrading(true);
    try {
      const res = await fetch("/api/results/regrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId, onlyFailed: false })
      });
      const data = await res.json();
      if (res.ok) {
        const refreshed = await fetch(`/api/assessments/details/${id}`).then(r => r.json());
        if (refreshed.assessment) {
          setAssessment(refreshed.assessment);
          const updatedStudent = refreshed.assessment.results.find((r: any) => r.id === resultId);
          if (updatedStudent) {
            setSelectedStudentResult({
              ...updatedStudent,
              parsedDetails: JSON.parse(updatedStudent.details)
            });
          }
        }
      } else {
        alert("Failed to re-grade student: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
    }
    setIsRegrading(false);
  };

  const handleManualOverride = async (resultId: string, questionId: string, isCorrect: boolean, marks: number) => {
    try {
      const res = await fetch("/api/results/regrade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultId,
          questionId,
          isCorrect,
          awardedMarks: isCorrect ? marks : 0,
          feedback: isCorrect ? "Manually marked Correct by Trainer." : "Manually marked Wrong by Trainer."
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedStudentResult((prev: any) => ({
          ...prev,
          score: data.result.score,
          details: data.result.details,
          parsedDetails: data.details
        }));
        await fetchAssessment();
      }
    } catch (err) {
      console.error("Failed manual override:", err);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!assessment) return <div className="p-8">Assessment not found.</div>;

  const maxScore = assessment.questions.reduce((total: any, q: any) => total + q.marks, 0);
  const failedGradesCount = (assessment.results || []).filter((r: any) =>
    r.details?.includes("Auto-grader failed") || r.details?.includes("Manual review required")
  ).length;

  const filteredAndSortedResults = [...(assessment.results || [])]
    .filter((r: any) => {
      const q = searchQuery.toLowerCase();
      return (
        r.student.name.toLowerCase().includes(q) ||
        r.student.email.toLowerCase().includes(q) ||
        r.student.mobile.includes(q)
      );
    })
    .sort((a: any, b: any) => {
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
    if (!filteredAndSortedResults.length) return;
    
    const headers = ["S.No", "Student Name", "Email", "Mobile", "Score", "Total Marks", "Malpractice Violations", "Date Taken"];
    const rows = filteredAndSortedResults.map((result: any, index: number) => {
      const details = JSON.parse(result.details);
      const violations = details.meta?.violations || 0;
      return [
        index + 1,
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

  const pendingResumeRequests = (assessment.students || []).filter(
    (s: any) => s.status === "RESUME_REQUESTED"
  );

  const activeStudents = (assessment.students || []).filter(
    (s: any) => (!s.results || s.results.length === 0) && s.status !== "COMPLETED"
  );

  const getDraftCount = (draftAnswersJson: string | null) => {
    if (!draftAnswersJson) return 0;
    try {
      const obj = JSON.parse(draftAnswersJson);
      return Object.keys(obj).length;
    } catch {
      return 0;
    }
  };

  const formatTimeRemaining = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return `${assessment.duration}m (full)`;
    if (seconds <= 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatLastActive = (dateStr: string | null) => {
    if (!dateStr) return "Not active yet";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 30) return "🟢 Active now";
    if (diffSecs < 120) return "🟡 1m ago";
    if (diffSecs < 3600) return `🟡 ${Math.floor(diffSecs / 60)}m ago`;
    return `🔴 Offline (${Math.floor(diffSecs / 3600)}h ago)`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/trainer" className="text-indigo-600 hover:text-indigo-800 hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{assessment.title}</h1>
            <span className={`px-2 py-1 text-xs font-bold rounded ${assessment.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'}`}>
              {assessment.status}
            </span>
          </div>
          <p className="text-slate-500 mt-1 font-medium">
            Join Code: <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{assessment.joinCode}</span> 
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
          {failedGradesCount > 0 && (
            <button
              onClick={() => handleRegradeAssessment(true)}
              disabled={isRegrading}
              className="bg-amber-500 border border-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition flex items-center disabled:opacity-50"
            >
              {isRegrading ? "Re-evaluating..." : `Re-evaluate Failed AI (${failedGradesCount})`}
            </button>
          )}
          <button 
            onClick={handleDownloadCSV}
            className="bg-green-600 border border-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            Export to Excel
          </button>
          <button 
            onClick={() => setShowQuestionsModal(true)}
            className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition"
          >
            Manage Questions
          </button>
          <button 
            onClick={() => setShowEditModal(true)}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            Edit Settings
          </button>
        </div>
      </header>

      {/* Urgent Alert Banner: Students Requesting Resume */}
      {pendingResumeRequests.length > 0 && (
        <div className="mb-8 p-5 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-sm animate-pulse-subtle">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-amber-950 font-black text-lg">
                  {pendingResumeRequests.length} Student{pendingResumeRequests.length > 1 ? "s" : ""} Waiting for Test Resumption Approval
                </h3>
                <p className="text-amber-800 text-sm mt-1 max-w-3xl">
                  A power-off, battery cut, or network disconnection occurred during their exam. Their answers and remaining time are safely preserved in the database. 
                  <span className="font-bold underline ml-1">The student cannot continue unless you click &quot;Allow Resume&quot; below.</span>
                </p>
              </div>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-3 py-1 rounded-full">
              Action Required
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {pendingResumeRequests.map((s: any) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-amber-200 shadow-sm gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-900 text-base">{s.name}</span>
                    <span className="text-slate-500 text-sm font-medium">({s.email} • {s.mobile})</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 font-medium">
                    <span className="bg-slate-100 px-2.5 py-1 rounded-md text-slate-700">
                      📝 {getDraftCount(s.draftAnswers)} / {assessment.questions.length} Answers Saved
                    </span>
                    <span className="bg-slate-100 px-2.5 py-1 rounded-md text-slate-700">
                      ⏱️ {formatTimeRemaining(s.timeLeft)} remaining
                    </span>
                    <span className="bg-slate-100 px-2.5 py-1 rounded-md text-slate-700">
                      🚨 {s.violations || 0} Malpractice Violations
                    </span>
                    {s.resumeRequestedAt && (
                      <span className="text-amber-700">
                        Requested: {new Date(s.resumeRequestedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleResumeAction(s.id, "APPROVE")}
                    disabled={actionLoading[s.id]}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center disabled:opacity-50"
                  >
                    {actionLoading[s.id] ? "Updating..." : "✅ Allow Resume"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to REJECT ${s.name}'s request to resume? They will be blocked from continuing.`)) {
                        handleResumeAction(s.id, "REJECT");
                      }
                    }}
                    disabled={actionLoading[s.id]}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center disabled:opacity-50"
                  >
                    {actionLoading[s.id] ? "Updating..." : "❌ Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions & Resume Control Table */}
      {activeStudents.length > 0 && (
        <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Active Exam Sessions & Resume Control</span>
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {activeStudents.length} Active
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Students currently taking the test, waiting to start, or paused due to power/network interruptions.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Auto-updating live
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Session Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Saved Drafts</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Time Left</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Violations</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Activity</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {activeStudents.map((s: any) => {
                  const draftCount = getDraftCount(s.draftAnswers);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.email} • {s.mobile}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.status === "RESUME_REQUESTED" && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            ⚠️ Resume Requested
                          </span>
                        )}
                        {s.status === "RESUME_APPROVED" && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            ✅ Allowed to Resume
                          </span>
                        )}
                        {s.status === "RESUME_REJECTED" && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            ⛔ Resume Declined
                          </span>
                        )}
                        {s.status === "IN_PROGRESS" && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            🟢 In Exam
                          </span>
                        )}
                        {(s.status === "NOT_STARTED" || !s.status) && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                            ⚪ Waiting to Start
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {draftCount > 0 ? (
                          <span className="font-bold text-indigo-600">{draftCount} / {assessment.questions.length} saved</span>
                        ) : (
                          <span className="text-slate-400">0 saved</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">
                        {formatTimeRemaining(s.timeLeft)}
                      </td>
                      <td className="px-4 py-3">
                        {s.violations > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                            {s.violations} Tab Switches
                          </span>
                        ) : (
                          <span className="text-emerald-700 text-xs font-bold">0 Clean</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {formatLastActive(s.lastHeartbeat)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          {s.status === "RESUME_REQUESTED" && (
                            <>
                              <button
                                onClick={() => handleResumeAction(s.id, "APPROVE")}
                                disabled={actionLoading[s.id]}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition disabled:opacity-50"
                              >
                                Allow
                              </button>
                              <button
                                onClick={() => handleResumeAction(s.id, "REJECT")}
                                disabled={actionLoading[s.id]}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-sm transition disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {s.status === "RESUME_REJECTED" && (
                            <button
                              onClick={() => handleResumeAction(s.id, "APPROVE")}
                              disabled={actionLoading[s.id]}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition disabled:opacity-50"
                            >
                              Allow Resume
                            </button>
                          )}
                          {s.status === "RESUME_APPROVED" && (
                            <button
                              onClick={() => handleResumeAction(s.id, "REJECT")}
                              disabled={actionLoading[s.id]}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-sm transition disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Reset session for ${s.name}? This will clear all draft answers and start their exam afresh.`)) {
                                handleResumeAction(s.id, "RESET");
                              }
                            }}
                            disabled={actionLoading[s.id]}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 transition disabled:opacity-50"
                            title="Reset student session"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Student Results ({filteredAndSortedResults.length})</h2>
        <div className="flex items-center space-x-4">
          <input 
            type="text" 
            placeholder="Search by name, email, or mobile..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-1.5 text-sm text-gray-900 focus:ring-blue-500 outline-none bg-white w-64"
          />
          <div className="flex items-center space-x-2 border-l pl-4 border-gray-200">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort by:</label>
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
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
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
            {filteredAndSortedResults.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? "No students found matching your search." : "No students have taken this assessment yet."}
                </td>
              </tr>
            ) : (
              filteredAndSortedResults.map((result: any, index: number) => {
                const details = JSON.parse(result.details);
                const violations = details.meta?.violations || 0;
                const needsManualReview =
                  result.details?.includes("Auto-grader failed") ||
                  result.details?.includes("Manual review required");
                return (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500 font-medium">{index + 1}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{result.student.name}</td>
                    <td className="px-6 py-4 text-gray-500">{result.student.email}</td>
                    <td className="px-6 py-4 text-gray-500">{result.student.mobile}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-blue-600">{result.score}</span> <span className="text-gray-400">/ {maxScore}</span>
                      {needsManualReview && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                          Needs Review
                        </span>
                      )}
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
                    <td className="px-6 py-4 text-sm font-medium flex items-center space-x-3">
                      <button onClick={() => setSelectedStudentResult({ ...result, parsedDetails: details })} className="text-blue-600 hover:text-blue-900">
                        View Answers
                      </button>
                      <button 
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to delete the record for ${result.student.name}?`)) return;
                          try {
                            const res = await fetch("/api/students/delete", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: result.id })
                            });
                            if (res.ok) fetchAssessment();
                            else alert("Failed to delete record.");
                          } catch (err) {
                            alert("Error deleting record.");
                          }
                        }} 
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
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
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleRegradeStudent(selectedStudentResult.id)}
                  disabled={isRegrading}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isRegrading ? "Re-grading..." : "Re-evaluate with AI"}
                </button>
                <button 
                  onClick={() => setSelectedStudentResult(null)}
                  className="text-gray-500 hover:text-gray-800 p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {assessment.questions.map((q: any, index: number) => {
                const res = selectedStudentResult.parsedDetails[q.id] || { studentAnswer: "No Answer", isCorrect: false, awardedMarks: 0, feedback: "" };
                return (
                  <div key={q.id} className={`bg-white p-6 rounded-xl border ${res.isCorrect ? 'border-green-300' : 'border-red-300'} shadow-sm`}>
                    <div className="flex justify-between items-start mb-4 gap-4">
                      <h3 className="text-lg font-medium text-gray-900 font-bold whitespace-pre-wrap flex-1">Q{index + 1}. {q.text}</h3>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => handleManualOverride(selectedStudentResult.id, q.id, true, q.marks)}
                          className={`px-2.5 py-1 rounded text-xs font-bold border transition ${
                            res.isCorrect
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-white text-green-700 border-green-300 hover:bg-green-50"
                          }`}
                          title="Manually mark as Correct"
                        >
                          ✓ Mark Correct
                        </button>
                        <button
                          onClick={() => handleManualOverride(selectedStudentResult.id, q.id, false, q.marks)}
                          className={`px-2.5 py-1 rounded text-xs font-bold border transition ${
                            !res.isCorrect
                              ? "bg-red-600 text-white border-red-600"
                              : "bg-white text-red-700 border-red-300 hover:bg-red-50"
                          }`}
                          title="Manually mark as Wrong"
                        >
                          ✕ Mark Wrong
                        </button>
                        <span className={`px-3 py-1 rounded text-sm font-bold ${res.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {res.awardedMarks} / {q.marks} Marks
                        </span>
                      </div>
                    </div>
                    
                    {q.imageUrl && (
                      <div className="mb-4 p-3 bg-blue-50/60 border border-blue-200 rounded-lg">
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Reference Table / Schema Picture:</p>
                        <img 
                          src={q.imageUrl} 
                          alt="Table reference" 
                          className="max-h-64 rounded border bg-white object-contain cursor-pointer shadow-sm hover:opacity-95"
                          onClick={() => window.open(q.imageUrl, '_blank')}
                          title="Click to open full image"
                        />
                      </div>
                    )}

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
                      <div className="font-medium text-green-700 bg-green-50 p-2 rounded whitespace-pre-wrap">{q.correctAnswer}</div>
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

      {showQuestionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h2 className="text-2xl font-bold text-gray-900">Manage Questions</h2>
              <button onClick={() => setShowQuestionsModal(false)} className="text-gray-500 hover:text-gray-800 p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {/* Quick banner to apply 1 SQL Table image to all SQL questions in this assessment */}
            <div className="p-4 bg-blue-50/70 border-b border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  SQL Table Feature
                </span>
                <p className="text-sm font-bold text-gray-900 mt-1">Upload SQL Table Picture for All Queries</p>
                <p className="text-xs text-gray-500">Apply one schema/dataset image to all SQL questions in this assessment.</p>
              </div>
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm whitespace-nowrap">
                Upload & Apply to All SQL
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const dataUrl = reader.result as string;
                      const res = await fetch("/api/questions/apply-sql-image", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ assessmentId: id, imageUrl: dataUrl })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        alert(`Successfully attached table picture to ${data.updatedCount} SQL questions!`);
                        fetchAssessment();
                      } else {
                        alert("Failed to apply image");
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {assessment.questions.map((q: any, index: number) => (
                <div key={q.id} className="border border-gray-200 p-4 rounded-lg bg-gray-50 flex flex-col">
                  {editingQuestion?.id === q.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                        <textarea 
                          className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          value={editingQuestion.text}
                          onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer / Reference</label>
                        <textarea 
                          className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                          rows={3}
                          value={editingQuestion.correctAnswer || ""}
                          onChange={e => setEditingQuestion({...editingQuestion, correctAnswer: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                        <input 
                          className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                          type="number"
                          value={editingQuestion.marks}
                          onChange={e => setEditingQuestion({...editingQuestion, marks: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reference Table / Schema Picture (Optional)</label>
                        <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-white flex flex-col items-center justify-center">
                          {editingQuestion.imageUrl ? (
                            <div className="w-full text-center">
                              <img src={editingQuestion.imageUrl} alt="Table diagram" className="max-h-40 mx-auto rounded border bg-gray-50 shadow-sm mb-2 object-contain" />
                              <button
                                type="button"
                                onClick={() => setEditingQuestion({...editingQuestion, imageUrl: null})}
                                className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 border border-red-200 px-3 py-1 rounded"
                              >
                                ✕ Remove Picture
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer text-center w-full py-2 hover:bg-gray-50 rounded transition">
                              <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <span className="text-sm font-semibold text-blue-600 hover:underline">Upload Table Screenshot / Diagram</span>
                              <p className="text-xs text-gray-500 mt-0.5">PNG, JPG, or WEBP</p>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = () => setEditingQuestion({...editingQuestion, imageUrl: reader.result as string});
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end space-x-3 pt-2">
                        <button 
                          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition" 
                          onClick={() => setEditingQuestion(null)}
                        >
                          Cancel
                        </button>
                        <button 
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition" 
                          disabled={isSaving}
                          onClick={async () => {
                            setIsSaving(true);
                            await fetch("/api/questions/update", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(editingQuestion)
                            });
                            await fetchAssessment();
                            setEditingQuestion(null);
                            setIsSaving(false);
                          }}
                        >
                          {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-gray-900 whitespace-pre-wrap flex-1">
                          <span className="text-blue-600 mr-2">Q{index+1}.</span> 
                          {q.text}
                        </div>
                        <button 
                          className="text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded text-sm font-medium transition" 
                          onClick={() => setEditingQuestion(q)}
                        >
                          Edit Question
                        </button>
                      </div>
                      {q.imageUrl && (
                        <div className="my-2 flex items-center space-x-3 bg-blue-50 border border-blue-200 p-2 rounded-lg w-fit">
                          <img src={q.imageUrl} alt="Table diagram" className="h-12 w-auto rounded border bg-white object-contain" />
                          <span className="text-xs font-bold text-blue-700">📷 Table / Diagram Attached</span>
                        </div>
                      )}
                      <div className="bg-white p-3 rounded border border-gray-200 mt-3">
                        <p className="text-sm font-medium text-gray-500 mb-1">Correct Answer:</p>
                        <pre className="text-sm text-green-700 font-mono overflow-x-auto">{q.correctAnswer || "None"}</pre>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 font-medium">Marks: {q.marks}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
