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
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit State
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);

  const fetchAssessment = async () => {
    try {
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
  const [attendanceFilter, setAttendanceFilter] = useState<"ALL" | "ATTENDING" | "WAITING" | "RESUME" | "COMPLETED">("ALL");

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
        await fetchAssessment();
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-600">Loading Assessment Details...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-slate-900">Assessment not found</h2>
        <Link href="/trainer" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
          &larr; Return to Dashboard
        </Link>
      </div>
    );
  }

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
        return vB - vA;
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

  const allJoinedStudents = assessment.students || [];

  const pendingResumeRequests = allJoinedStudents.filter(
    (s: any) => s.status === "RESUME_REQUESTED"
  );

  const attendingStudents = allJoinedStudents.filter(
    (s: any) => (!s.results || s.results.length === 0) && s.status !== "COMPLETED" && (s.status === "IN_PROGRESS" || s.hasStarted)
  );

  const waitingStudents = allJoinedStudents.filter(
    (s: any) => (!s.results || s.results.length === 0) && s.status !== "COMPLETED" && !s.hasStarted && s.status !== "RESUME_REQUESTED" && s.status !== "RESUME_REJECTED"
  );

  const resumeNeededStudents = allJoinedStudents.filter(
    (s: any) => s.status === "RESUME_REQUESTED"
  );

  const completedStudents = allJoinedStudents.filter(
    (s: any) => (s.results && s.results.length > 0) || s.status === "COMPLETED"
  );

  const filteredAttendanceStudents = allJoinedStudents.filter((s: any) => {
    if (attendanceFilter === "ATTENDING") {
      return (!s.results || s.results.length === 0) && s.status !== "COMPLETED" && (s.status === "IN_PROGRESS" || s.hasStarted);
    }
    if (attendanceFilter === "WAITING") {
      return (!s.results || s.results.length === 0) && s.status !== "COMPLETED" && !s.hasStarted && s.status !== "RESUME_REQUESTED" && s.status !== "RESUME_REJECTED";
    }
    if (attendanceFilter === "RESUME") {
      return s.status === "RESUME_REQUESTED";
    }
    if (attendanceFilter === "COMPLETED") {
      return (s.results && s.results.length > 0) || s.status === "COMPLETED";
    }
    return true;
  });

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

  const formatJoinedTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?code=${assessment.joinCode}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <Link 
              href="/trainer" 
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition mb-3 group"
            >
              <span className="group-hover:-translate-x-1 transition-transform">&larr;</span>
              <span>Back to Dashboard</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {assessment.title}
              </h1>
              <span className={`px-3 py-1 text-xs font-black rounded-full uppercase tracking-wider ${
                assessment.status === 'PUBLISHED' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {assessment.status === 'PUBLISHED' ? '● Live Published' : '○ Draft Mode'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs sm:text-sm text-slate-600 font-medium">
              <div className="inline-flex items-center gap-2 bg-indigo-50/70 border border-indigo-200/80 px-3 py-1.5 rounded-xl">
                <span className="text-slate-500 font-semibold">Join Code:</span>
                <span className="font-mono font-black text-indigo-700 tracking-wider">
                  {assessment.joinCode}
                </span>
                <button 
                  onClick={handleCopyLink}
                  className="ml-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                >
                  {copiedCode ? "✅ Copied!" : "📋 Copy Link"}
                </button>
              </div>

              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-semibold">
                ⏱️ {assessment.duration} Minutes
              </span>

              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-semibold">
                🎯 {assessment.questions.length} Questions ({maxScore} Marks)
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {failedGradesCount > 0 && (
              <button
                onClick={() => handleRegradeAssessment(true)}
                disabled={isRegrading}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>🤖</span>
                <span>{isRegrading ? "Re-evaluating..." : `Re-evaluate AI (${failedGradesCount})`}</span>
              </button>
            )}

            <button 
              onClick={handleDownloadCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span>Export CSV</span>
            </button>

            <button 
              onClick={() => setShowQuestionsModal(true)}
              className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>📝</span>
              <span>Manage Questions</span>
            </button>

            <button 
              onClick={() => setShowEditModal(true)}
              className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>Edit Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Urgent Alert Banner: Students Requesting Resume */}
      {pendingResumeRequests.length > 0 && (
        <div className="p-6 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border-2 border-amber-400 rounded-3xl shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3.5">
              <span className="text-3xl animate-bounce">⚠️</span>
              <div>
                <h3 className="text-amber-950 font-black text-lg">
                  {pendingResumeRequests.length} Student{pendingResumeRequests.length > 1 ? "s" : ""} Waiting for Test Resumption Approval
                </h3>
                <p className="text-amber-800 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
                  A power-off, battery cut, or network disconnection occurred during their exam. Their answers and remaining time are safely preserved in the database. 
                  <span className="font-bold underline ml-1">The student cannot continue unless you click &quot;Allow Resume&quot; below.</span>
                </p>
              </div>
            </div>
            <span className="text-xs font-black uppercase tracking-wider bg-amber-300/80 text-amber-950 px-3 py-1 rounded-full shrink-0 hidden sm:inline">
              Action Required
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {pendingResumeRequests.map((s: any) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-2xl border border-amber-200 shadow-sm gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-900 text-base">{s.name}</span>
                    <span className="text-slate-500 text-xs sm:text-sm font-medium">({s.email} • {s.mobile})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600 font-medium">
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 font-semibold">
                      📝 {getDraftCount(s.draftAnswers)} / {assessment.questions.length} Answers Saved
                    </span>
                    <span className="bg-indigo-50 px-2.5 py-1 rounded-lg text-indigo-700 font-semibold">
                      ⏱️ {formatTimeRemaining(s.timeLeft)} remaining
                    </span>
                    <span className="bg-rose-50 px-2.5 py-1 rounded-lg text-rose-700 font-semibold">
                      🚨 {s.violations || 0} Tab Switches
                    </span>
                    {s.resumeRequestedAt && (
                      <span className="text-amber-700 font-semibold">
                        Requested: {new Date(s.resumeRequestedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleResumeAction(s.id, "APPROVE")}
                    disabled={actionLoading[s.id]}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center disabled:opacity-50"
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
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center disabled:opacity-50"
                  >
                    {actionLoading[s.id] ? "Updating..." : "❌ Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student Attendance & Live Exam Monitoring Section */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span>👥 Student Attendance &amp; Live Monitoring</span>
              <span className="bg-indigo-100 text-indigo-800 text-xs px-3 py-1 rounded-full font-black">
                {allJoinedStudents.length} Joined
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Real-time attendance of all students who joined with the code and are attending the exam.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Live Sync (Auto-refreshes every 5s)
            </span>
          </div>
        </div>

        {/* 5 KPI Summary Cards (Clickable Filter Controls) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-6">
          <div 
            onClick={() => setAttendanceFilter("ALL")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              attendanceFilter === "ALL" 
                ? 'bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-slate-900 shadow-md ring-2 ring-indigo-500' 
                : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <div className={`text-[11px] font-bold uppercase tracking-wider ${attendanceFilter === "ALL" ? 'text-indigo-300' : 'text-slate-500'}`}>
              Total Joined
            </div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{allJoinedStudents.length}</div>
            <div className={`text-[11px] mt-1 ${attendanceFilter === "ALL" ? 'text-slate-300' : 'text-slate-500 font-medium'}`}>
              All registered
            </div>
          </div>

          <div 
            onClick={() => setAttendanceFilter("ATTENDING")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              attendanceFilter === "ATTENDING" 
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300' 
                : 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300 text-emerald-950 hover:bg-emerald-100/70'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full ${attendanceFilter === "ATTENDING" ? 'bg-white' : 'bg-emerald-500'} animate-ping`}></span>
              <span>Attending Now</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{attendingStudents.length}</div>
            <div className={`text-[11px] mt-1 ${attendanceFilter === "ATTENDING" ? 'text-emerald-100' : 'text-emerald-700 font-medium'}`}>
              Actively in exam
            </div>
          </div>

          <div 
            onClick={() => setAttendanceFilter("WAITING")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              attendanceFilter === "WAITING" 
                ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300' 
                : 'bg-amber-50/70 border-amber-200 hover:border-amber-300 text-amber-950 hover:bg-amber-100/70'
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider">Waiting to Start</div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{waitingStudents.length}</div>
            <div className={`text-[11px] mt-1 ${attendanceFilter === "WAITING" ? 'text-amber-100' : 'text-amber-700 font-medium'}`}>
              Joined, not started
            </div>
          </div>

          <div 
            onClick={() => setAttendanceFilter("RESUME")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              attendanceFilter === "RESUME" 
                ? 'bg-gradient-to-br from-rose-600 to-pink-700 text-white border-rose-600 shadow-md ring-2 ring-rose-300' 
                : 'bg-rose-50/70 border-rose-200 hover:border-rose-300 text-rose-950 hover:bg-rose-100/70'
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider">Needs Resume</div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{resumeNeededStudents.length}</div>
            <div className={`text-[11px] mt-1 ${attendanceFilter === "RESUME" ? 'text-rose-100' : 'text-rose-700 font-medium'}`}>
              Interrupted sessions
            </div>
          </div>

          <div 
            onClick={() => setAttendanceFilter("COMPLETED")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              attendanceFilter === "COMPLETED" 
                ? 'bg-gradient-to-br from-blue-600 to-cyan-700 text-white border-blue-600 shadow-md ring-2 ring-blue-300' 
                : 'bg-blue-50/70 border-blue-200 hover:border-blue-300 text-blue-950 hover:bg-blue-100/70'
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider">Completed</div>
            <div className="text-2xl sm:text-3xl font-black mt-1">{completedStudents.length}</div>
            <div className={`text-[11px] mt-1 ${attendanceFilter === "COMPLETED" ? 'text-blue-100' : 'text-blue-700 font-medium'}`}>
              Submitted tests
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setAttendanceFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-xl transition whitespace-nowrap ${
              attendanceFilter === "ALL" ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Joined ({allJoinedStudents.length})
          </button>
          <button
            onClick={() => setAttendanceFilter("ATTENDING")}
            className={`px-3.5 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
              attendanceFilter === "ATTENDING" ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Attending Now ({attendingStudents.length})
          </button>
          <button
            onClick={() => setAttendanceFilter("WAITING")}
            className={`px-3.5 py-1.5 rounded-xl transition whitespace-nowrap ${
              attendanceFilter === "WAITING" ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            Waiting ({waitingStudents.length})
          </button>
          <button
            onClick={() => setAttendanceFilter("RESUME")}
            className={`px-3.5 py-1.5 rounded-xl transition whitespace-nowrap ${
              attendanceFilter === "RESUME" ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            Needs Resume ({resumeNeededStudents.length})
          </button>
          <button
            onClick={() => setAttendanceFilter("COMPLETED")}
            className={`px-3.5 py-1.5 rounded-xl transition whitespace-nowrap ${
              attendanceFilter === "COMPLETED" ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            Completed ({completedStudents.length})
          </button>
        </div>

        {/* Attendance List Table */}
        {allJoinedStudents.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-300 rounded-2xl bg-slate-50">
            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">No students have joined yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4 leading-relaxed">
              Share the Join Code <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{assessment.joinCode}</span> with students. Once they enter their details, their attendance status and live exam progress will show up here automatically!
            </p>
            <button
              onClick={handleCopyLink}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition"
            >
              📋 Copy Student Invite Link
            </button>
          </div>
        ) : filteredAttendanceStudents.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs font-medium">
            No students found in the &quot;{attendanceFilter}&quot; filter.{" "}
            <button 
              onClick={() => setAttendanceFilter("ALL")} 
              className="text-indigo-600 underline font-bold ml-1 hover:text-indigo-800"
            >
              Show all {allJoinedStudents.length} joined students
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student Details</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Joined At</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Exam Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Time Left</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Violations</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Activity</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAttendanceStudents.map((s: any) => {
                  const draftCount = getDraftCount(s.draftAnswers);
                  const isCompleted = (s.results && s.results.length > 0) || s.status === "COMPLETED";
                  const isAttending = !isCompleted && (s.status === "IN_PROGRESS" || s.hasStarted);
                  const isWaiting = !isCompleted && !s.hasStarted && s.status !== "RESUME_REQUESTED" && s.status !== "RESUME_REJECTED";
                  const resultScore = s.results?.[0]?.score;
                  const progressPercent = Math.min(100, Math.round((draftCount / (assessment.questions.length || 1)) * 100));

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.email} • {s.mobile}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-slate-600 whitespace-nowrap">
                        {formatJoinedTime(s.joinedAt)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isAttending && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            Attending (In Exam)
                          </span>
                        )}
                        {isWaiting && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            🟡 Joined (Waiting to Start)
                          </span>
                        )}
                        {s.status === "RESUME_REQUESTED" && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
                            ⚠️ Resume Requested
                          </span>
                        )}
                        {s.status === "RESUME_APPROVED" && !isCompleted && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            ✅ Allowed to Resume
                          </span>
                        )}
                        {s.status === "RESUME_REJECTED" && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">
                            ⛔ Resume Declined
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            🏁 Completed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {isCompleted ? (
                          <span className="font-bold text-slate-900 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100 inline-block">
                            Score: {resultScore ?? 0} / {maxScore}
                          </span>
                        ) : isAttending ? (
                          <div className="w-32">
                            <div className="flex justify-between font-bold text-slate-700 mb-1 text-[11px]">
                              <span>{draftCount} / {assessment.questions.length} saved</span>
                              <span>{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all duration-300" 
                                style={{ width: `${progressPercent}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium italic">Not started yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-semibold text-xs whitespace-nowrap">
                        {isCompleted ? (
                          <span className="text-slate-400">Submitted</span>
                        ) : isAttending ? (
                          <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {formatTimeRemaining(s.timeLeft)}
                          </span>
                        ) : (
                          <span className="text-slate-500">{assessment.duration}m (full)</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.violations > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            🚨 {s.violations} Switches
                          </span>
                        ) : (
                          <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            ✓ Clean
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {isCompleted ? (
                          <span className="text-slate-400">Finished</span>
                        ) : (
                          formatLastActive(s.lastHeartbeat)
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {s.status === "RESUME_REQUESTED" && (
                            <>
                              <button
                                onClick={() => handleResumeAction(s.id, "APPROVE")}
                                disabled={actionLoading[s.id]}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                              >
                                Allow
                              </button>
                              <button
                                onClick={() => handleResumeAction(s.id, "REJECT")}
                                disabled={actionLoading[s.id]}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {s.status === "RESUME_REJECTED" && (
                            <button
                              onClick={() => handleResumeAction(s.id, "APPROVE")}
                              disabled={actionLoading[s.id]}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                            >
                              Allow Resume
                            </button>
                          )}
                          {s.status === "RESUME_APPROVED" && !isCompleted && (
                            <button
                              onClick={() => handleResumeAction(s.id, "REJECT")}
                              disabled={actionLoading[s.id]}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          )}
                          {!isCompleted && (
                            <button
                              onClick={() => {
                                if (confirm(`Reset session for ${s.name}? This will clear all draft answers and start their exam afresh.`)) {
                                  handleResumeAction(s.id, "RESET");
                                }
                              }}
                              disabled={actionLoading[s.id]}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition disabled:opacity-50"
                              title="Reset student session"
                            >
                              Reset
                            </button>
                          )}
                          {isCompleted && s.results?.[0] && (
                            <button
                              onClick={() => {
                                const res = s.results[0];
                                setSelectedStudentResult({
                                  ...res,
                                  student: s,
                                  parsedDetails: JSON.parse(res.details)
                                });
                              }}
                              className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold rounded-lg transition"
                            >
                              View Submission
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Results Section */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>🏆 Student Submissions &amp; Scores</span>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-black">
                {filteredAndSortedResults.length} Submitted
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Final marks awarded by AI auto-grader with review &amp; manual score adjustment tools.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search by name, email, or mobile..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 border border-slate-300 rounded-xl px-4 py-2 text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 focus:bg-white transition"
              />
              <span className="absolute right-3 top-2.5 text-slate-400">🔍</span>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Sort:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 cursor-pointer"
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

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Student Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Score</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Malpractice</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date Taken</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredAndSortedResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <p className="text-sm font-semibold">{searchQuery ? "No students found matching your search." : "No student submissions yet."}</p>
                    <p className="text-xs text-slate-400 mt-1">When students complete their exams, their grades and AI breakdown will appear here.</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedResults.map((result: any, index: number) => {
                  const details = JSON.parse(result.details);
                  const violations = details.meta?.violations || 0;
                  const needsManualReview =
                    result.details?.includes("Auto-grader failed") ||
                    result.details?.includes("Manual review required");
                  const percent = Math.round((result.score / (maxScore || 1)) * 100);

                  return (
                    <tr key={result.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 text-slate-400 font-bold">{index + 1}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">{result.student.name}</td>
                      <td className="px-4 py-3.5 text-slate-500">{result.student.email}</td>
                      <td className="px-4 py-3.5 text-slate-500">{result.student.mobile}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-indigo-600 text-sm">{result.score}</span>
                          <span className="text-slate-400 text-xs">/ {maxScore}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            percent >= 70 ? 'bg-emerald-100 text-emerald-800' :
                            percent >= 40 ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {percent}%
                          </span>
                        </div>
                        {needsManualReview && (
                          <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            ⚠️ Needs Review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {violations > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            🚨 {violations} Switches
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            ✓ Clean
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(result.completedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => setSelectedStudentResult({ ...result, parsedDetails: details })} 
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition"
                          >
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
                            className="px-2.5 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition"
                            title="Delete result"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Settings Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <h2 className="text-2xl font-black text-slate-900 mb-4">Edit Assessment Settings</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Assessment Title</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Duration (Minutes)</label>
                <input 
                  type="number" 
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Assessment Status</label>
                <select 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm cursor-pointer"
                >
                  <option value="PUBLISHED">Published (Active & Joinable)</option>
                  <option value="DRAFT">Draft (Closed)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition font-bold text-xs"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-sm"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Student Answers Review Modal */}
      {selectedStudentResult && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/80">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  {selectedStudentResult.student.name}&apos;s Answers
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Total Awarded Score: <span className="font-bold text-indigo-600">{selectedStudentResult.score}</span> / {maxScore}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleRegradeStudent(selectedStudentResult.id)}
                  disabled={isRegrading}
                  className="bg-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
                >
                  {isRegrading ? "Re-grading..." : "🤖 Re-evaluate with AI"}
                </button>
                <button 
                  onClick={() => setSelectedStudentResult(null)}
                  className="text-slate-400 hover:text-slate-800 p-2 rounded-xl transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {assessment.questions.map((q: any, index: number) => {
                const res = selectedStudentResult.parsedDetails[q.id] || { studentAnswer: "No Answer", isCorrect: false, awardedMarks: 0, feedback: "" };
                return (
                  <div key={q.id} className={`bg-white p-6 rounded-2xl border-2 ${res.isCorrect ? 'border-emerald-200' : 'border-rose-200'} shadow-sm`}>
                    <div className="flex justify-between items-start mb-4 gap-4">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 whitespace-pre-wrap flex-1">
                        <span className="text-indigo-600 mr-2">Q{index + 1}.</span>
                        {q.text}
                      </h3>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => handleManualOverride(selectedStudentResult.id, q.id, true, q.marks)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            res.isCorrect
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          }`}
                          title="Manually mark as Correct"
                        >
                          ✓ Mark Correct
                        </button>
                        <button
                          onClick={() => handleManualOverride(selectedStudentResult.id, q.id, false, q.marks)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            !res.isCorrect
                              ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                              : "bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
                          }`}
                          title="Manually mark as Wrong"
                        >
                          ✕ Mark Wrong
                        </button>
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-black ${res.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {res.awardedMarks} / {q.marks} Marks
                        </span>
                      </div>
                    </div>
                    
                    {q.imageUrl && (
                      <div className="mb-4 p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                        <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-2">Reference Table / Schema Picture:</p>
                        <img 
                          src={q.imageUrl} 
                          alt="Table reference" 
                          className="max-h-64 rounded-lg border bg-white object-contain cursor-pointer shadow-sm hover:opacity-95"
                          onClick={() => window.open(q.imageUrl, '_blank')}
                          title="Click to open full image"
                        />
                      </div>
                    )}

                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Student&apos;s Answer:</p>
                      {q.type === 'CODING' ? (
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto shadow-inner">{res.studentAnswer || "No code submitted."}</pre>
                      ) : (
                        <div className="font-bold text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm">{res.studentAnswer || "No answer selected."}</div>
                      )}
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Correct Answer / Reference:</p>
                      <div className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl whitespace-pre-wrap">{q.correctAnswer}</div>
                    </div>

                    {q.type === 'CODING' && res.feedback && (
                      <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
                        <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">🤖 AI Feedback:</p>
                        <p className="text-xs sm:text-sm text-indigo-950 font-medium">{res.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manage Questions Modal */}
      {showQuestionsModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/80">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Manage Assessment Questions</h2>
              <button onClick={() => setShowQuestionsModal(false)} className="text-slate-400 hover:text-slate-800 p-2 rounded-xl transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Quick banner to apply 1 SQL Table image to all SQL questions in this assessment */}
            <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                  SQL Table Batch Tool
                </span>
                <p className="text-sm font-bold text-slate-900 mt-1">Upload SQL Table Diagram for All Queries</p>
                <p className="text-xs text-slate-500">Apply one schema/dataset image to all SQL questions in this assessment in 1 click.</p>
              </div>
              <label className="cursor-pointer bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md whitespace-nowrap">
                Upload &amp; Apply to All SQL
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
                <div key={q.id} className="border border-slate-200 p-5 rounded-2xl bg-slate-50/70 flex flex-col">
                  {editingQuestion?.id === q.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Question Text</label>
                        <textarea 
                          className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          rows={3}
                          value={editingQuestion.text}
                          onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Correct Answer / Reference</label>
                        <textarea 
                          className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                          rows={3}
                          value={editingQuestion.correctAnswer || ""}
                          onChange={e => setEditingQuestion({...editingQuestion, correctAnswer: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Marks</label>
                        <input 
                          className="w-full border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          type="number"
                          value={editingQuestion.marks}
                          onChange={e => setEditingQuestion({...editingQuestion, marks: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Reference Table / Schema Picture (Optional)</label>
                        <div className="border border-dashed border-slate-300 rounded-2xl p-4 bg-white flex flex-col items-center justify-center">
                          {editingQuestion.imageUrl ? (
                            <div className="w-full text-center">
                              <img src={editingQuestion.imageUrl} alt="Table diagram" className="max-h-40 mx-auto rounded-lg border bg-slate-50 shadow-sm mb-2 object-contain" />
                              <button
                                type="button"
                                onClick={() => setEditingQuestion({...editingQuestion, imageUrl: null})}
                                className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg transition"
                              >
                                ✕ Remove Picture
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer text-center w-full py-2 hover:bg-slate-50 rounded-xl transition">
                              <svg className="w-8 h-8 text-slate-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs font-bold text-indigo-600 hover:underline">Upload Table Screenshot / Diagram</span>
                              <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, or WEBP</p>
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
                          className="bg-slate-200 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 transition" 
                          onClick={() => setEditingQuestion(null)}
                        >
                          Cancel
                        </button>
                        <button 
                          className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm" 
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
                        <div className="font-bold text-slate-900 whitespace-pre-wrap flex-1 text-sm">
                          <span className="text-indigo-600 mr-2">Q{index+1}.</span> 
                          {q.text}
                        </div>
                        <button 
                          className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg text-xs font-bold transition ml-3" 
                          onClick={() => setEditingQuestion(q)}
                        >
                          Edit Question
                        </button>
                      </div>
                      {q.imageUrl && (
                        <div className="my-2 flex items-center space-x-3 bg-indigo-50/70 border border-indigo-200 p-2 rounded-xl w-fit">
                          <img src={q.imageUrl} alt="Table diagram" className="h-12 w-auto rounded border bg-white object-contain" />
                          <span className="text-xs font-bold text-indigo-700">📷 Table / Diagram Attached</span>
                        </div>
                      )}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 mt-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Correct Answer / Reference:</p>
                        <pre className="text-xs text-emerald-700 font-mono overflow-x-auto">{q.correctAnswer || "None"}</pre>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 font-bold">Marks: {q.marks}</p>
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
