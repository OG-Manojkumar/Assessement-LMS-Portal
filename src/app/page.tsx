"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get("code") || "";

  const [formData, setFormData] = useState({
    joinCode: prefilledCode,
    name: "",
    email: "",
    mobile: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume State if previous exam was interrupted (power off, network loss)
  const [resumeInfo, setResumeInfo] = useState<{
    studentId: string;
    studentName: string;
    joinCode: string;
    savedCount: number;
    timeLeft: number | null;
  } | null>(null);
  const [resumeStatus, setResumeStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");

  // Poll for Trainer's Resume Approval every 3 seconds
  useEffect(() => {
    if (!resumeInfo || resumeStatus !== "PENDING") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/assessments/resume-action?studentId=${resumeInfo.studentId}`);
        const data = await res.json();
        if (data.canResume) {
          setResumeStatus("APPROVED");
          clearInterval(interval);
          localStorage.setItem("currentStudentId", resumeInfo.studentId);
          localStorage.setItem("currentStudentName", resumeInfo.studentName);
          setTimeout(() => {
            router.push(`/assessment/${resumeInfo.joinCode}`);
          }, 800);
        } else if (data.isRejected) {
          setResumeStatus("REJECTED");
          clearInterval(interval);
        }
      } catch (_) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [resumeInfo, resumeStatus, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 10-digit mobile number validation
    if (!/^\d{10}$/.test(formData.mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join assessment");
      }

      // If student was interrupted, require trainer permission to resume
      if (data.resumePending) {
        setResumeInfo({
          studentId: data.student.id,
          studentName: data.student.name,
          joinCode: formData.joinCode.toUpperCase(),
          savedCount: data.savedAnswersCount || 0,
          timeLeft: data.timeLeft,
        });
        setResumeStatus("PENDING");
        setIsLoading(false);
        return;
      }

      // Store student ID in session/localStorage for the assessment page
      localStorage.setItem("currentStudentId", data.student.id);
      localStorage.setItem("currentStudentName", data.student.name);

      // Redirect to the assessment page
      router.push(`/assessment/${formData.joinCode.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/25 rounded-full blur-3xl animate-pulse"></div>
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/25 rounded-full blur-3xl animate-pulse"></div>
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]"></div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-xl shadow-indigo-500/25 ring-1 ring-white/20 mb-4 transform hover:scale-105 transition-transform duration-300">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <h2 className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
          Besant Technologies
        </h2>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-white tracking-tight">
          Student Assessment Portal
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter your candidate credentials and Join Code to begin your exam
        </p>
      </div>

      {/* Main Glass Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 sm:p-9 text-slate-200 ring-1 ring-white/10">
          {resumeInfo ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30 shadow-lg shadow-amber-500/10">
                <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
                Session Interrupted
              </span>

              <h2 className="text-2xl font-black text-white mt-3 mb-2">
                Trainer Approval Required
              </h2>

              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Your previous test session was paused due to power cut, network loss, or window exit. Your answers and remaining time are safely stored in the database.
              </p>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-5 text-left text-xs space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Candidate:</span>
                  <span className="font-bold text-white">{resumeInfo.studentName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Assessment Code:</span>
                  <span className="font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                    {resumeInfo.joinCode}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Saved Answers:</span>
                  <span className="font-bold text-emerald-400">
                    ✅ {resumeInfo.savedCount} Question(s) Preserved
                  </span>
                </div>
                {resumeInfo.timeLeft && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Time Remaining:</span>
                    <span className="font-bold text-indigo-300">
                      ⏱️ {Math.floor(resumeInfo.timeLeft / 60)}m {resumeInfo.timeLeft % 60}s
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2.5 border-t border-slate-800">
                  <span className="text-slate-400">Permission:</span>
                  {resumeStatus === "PENDING" && (
                    <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                      <span>Waiting for Trainer...</span>
                    </span>
                  )}
                  {resumeStatus === "APPROVED" && (
                    <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                      ✅ Approved! Resuming...
                    </span>
                  )}
                  {resumeStatus === "REJECTED" && (
                    <span className="text-[11px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 rounded-full">
                      ❌ Resume Declined
                    </span>
                  )}
                </div>
              </div>

              {resumeStatus === "PENDING" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 italic">
                    Please inform your trainer to click <span className="font-bold text-amber-300">&quot;Allow Resume&quot;</span> on their dashboard. This screen will automatically resume once approved.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/assessments/resume-action?studentId=${resumeInfo.studentId}`);
                        const data = await res.json();
                        if (data.canResume) {
                          setResumeStatus("APPROVED");
                          localStorage.setItem("currentStudentId", resumeInfo.studentId);
                          localStorage.setItem("currentStudentName", resumeInfo.studentName);
                          router.push(`/assessment/${resumeInfo.joinCode}`);
                        } else if (data.isRejected) {
                          setResumeStatus("REJECTED");
                        } else {
                          alert("Still waiting for trainer approval. Please ask your trainer to click Allow Resume.");
                        }
                      } catch (e: any) {
                        alert("Error checking status: " + e.message);
                      }
                    }}
                    className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30"
                  >
                    Check Approval Status
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResumeInfo(null);
                      setResumeStatus("PENDING");
                    }}
                    className="w-full text-xs text-slate-400 hover:text-slate-200 transition py-1 font-medium"
                  >
                    ← Back to Join Form
                  </button>
                </div>
              )}

              {resumeStatus === "APPROVED" && (
                <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold animate-pulse">
                  ✅ Trainer approved your resume request! Redirecting you into your exam now...
                </div>
              )}

              {resumeStatus === "REJECTED" && (
                <div className="space-y-3">
                  <div className="p-4 bg-rose-500/20 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-medium">
                    <strong className="block text-rose-200 font-bold mb-1">Resume Request Declined</strong>
                    Your trainer did not permit resuming this exam. Please contact your coordinator.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResumeInfo(null);
                      setResumeStatus("PENDING");
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-xs transition"
                  >
                    Back to Join Form
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-xs flex items-center space-x-2 animate-shake">
                  <svg className="w-5 h-5 flex-shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="joinCode" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Assessment Join Code
                </label>
                <div className="relative">
                  <input
                    id="joinCode"
                    name="joinCode"
                    type="text"
                    required
                    placeholder="e.g. LXD266"
                    className="block w-full px-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl placeholder-slate-500 text-white font-mono font-bold tracking-widest text-base uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                    value={formData.joinCode}
                    onChange={(e) => setFormData({ ...formData, joinCode: e.target.value.toUpperCase() })}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                    🔑
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Candidate Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="block w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl placeholder-slate-500 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="e.g. student@example.com"
                  className="block w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl placeholder-slate-500 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="mobile" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Mobile Number (10 Digits)
                </label>
                <input
                  id="mobile"
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  title="Please enter a valid 10-digit mobile number"
                  className="block w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl placeholder-slate-500 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-xl shadow-indigo-600/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying & Entering Exam...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>Start Assessment</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Trainer Portal Access Link */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <Link
              href="/trainer"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1 group"
            >
              <span>Are you a Trainer or Admin? Go to Dashboard</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JoinAssessment() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950 text-white">Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}
