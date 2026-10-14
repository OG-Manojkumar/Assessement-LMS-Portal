"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
          timeLeft: data.timeLeft
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-2">
          <div className="h-16 w-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
        <h2 className="mt-4 text-center text-xl font-extrabold text-blue-600">
          Besant Technologies Mock Exams
        </h2>
        <h3 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
          Join Assessment
        </h3>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your details and the code provided by your trainer.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border">
          {resumeInfo ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider">
                Session Interrupted
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 mb-2">
                Trainer Approval Required
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Your previous test session was interrupted (power loss, network failure, or device restart).
              </p>

              <div className="bg-slate-50 border rounded-xl p-4 mb-6 text-left text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Student:</span>
                  <span className="font-bold text-gray-900">{resumeInfo.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Assessment:</span>
                  <span className="font-mono font-bold text-blue-600">{resumeInfo.joinCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Saved Answers:</span>
                  <span className="font-bold text-green-600">{resumeInfo.savedCount} Question(s) Preserved</span>
                </div>
                {resumeInfo.timeLeft && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time Left:</span>
                    <span className="font-bold text-gray-900">{Math.floor(resumeInfo.timeLeft / 60)} min {resumeInfo.timeLeft % 60}s</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Status:</span>
                  {resumeStatus === "PENDING" && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span>Waiting for Trainer...</span>
                    </span>
                  )}
                  {resumeStatus === "APPROVED" && (
                    <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                      ✅ Approved! Resuming...
                    </span>
                  )}
                  {resumeStatus === "REJECTED" && (
                    <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                      ❌ Resume Declined
                    </span>
                  )}
                </div>
              </div>

              {resumeStatus === "PENDING" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 italic">
                    Please ask your trainer to click <strong>&quot;Allow Resume&quot;</strong> on their dashboard. This screen will automatically resume once approved.
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
                          alert("Still waiting for trainer's approval. Please notify your trainer.");
                        }
                      } catch (e: any) {
                        alert("Error checking status: " + e.message);
                      }
                    }}
                    className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700 transition shadow"
                  >
                    Check Approval Status
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResumeInfo(null);
                      setResumeStatus("PENDING");
                    }}
                    className="w-full text-xs text-gray-500 hover:text-gray-700 font-medium py-1"
                  >
                    Cancel & Return to Join Form
                  </button>
                </div>
              )}

              {resumeStatus === "APPROVED" && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-bold animate-pulse">
                  ✅ Trainer approved your resume request! Redirecting you into your exam now...
                </div>
              )}

              {resumeStatus === "REJECTED" && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <strong>Resume Request Declined:</strong> Your trainer did not allow this exam session to be resumed.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResumeInfo(null);
                      setResumeStatus("PENDING");
                    }}
                    className="w-full bg-gray-200 text-gray-800 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-300 transition"
                  >
                    Back to Join Form
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="joinCode" className="block text-sm font-medium text-gray-700">
                Join Code
              </label>
              <div className="mt-1">
                <input
                  id="joinCode"
                  name="joinCode"
                  type="text"
                  required
                  placeholder="e.g. LXD266"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 uppercase"
                  value={formData.joinCode}
                  onChange={(e) => setFormData({ ...formData, joinCode: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="mobile" className="block text-sm font-medium text-gray-700">
                Mobile Number
              </label>
              <div className="mt-1">
                <input
                  id="mobile"
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  title="Please enter a valid 10-digit mobile number"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Start Assessment"}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JoinAssessment() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}
