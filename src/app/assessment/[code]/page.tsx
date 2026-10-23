"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";

export default function AssessmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [studentName, setStudentName] = useState<string | null>(null);
  
  // Results State
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmittingState, setIsSubmittingState] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const isSubmitting = useRef(false);
  
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  // Answers state: mapping question ID to the selected option / typed code
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedLanguage, setSelectedLanguage] = useState<Record<string, string>>({});
  const [runOutputs, setRunOutputs] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showSchemaInEditor, setShowSchemaInEditor] = useState<Record<string, boolean>>({});
  const [expandedSchema, setExpandedSchema] = useState<Record<string, boolean>>({});
  const [hasStartedExam, setHasStartedExam] = useState(false);
  const hasStartedExamRef = useRef(false);

  // Resume & crash recovery state
  const [sessionStatus, setSessionStatus] = useState<string>("NOT_STARTED");
  const [isResumedSession, setIsResumedSession] = useState(false);
  const [resumeAnswersCount, setResumeAnswersCount] = useState(0);

  const answersRef = useRef<Record<string, string>>({});
  const timeLeftRef = useRef(0);
  const violationsRef = useRef(0);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    violationsRef.current = violations;
  }, [violations]);

  const fetchAssessment = async () => {
    try {
      const res = await fetch(`/api/assessments/${code}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.assessment;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  useEffect(() => {
    // 1. Verify student is actually logged in
    const studentId = localStorage.getItem("currentStudentId");
    if (!studentId) {
      router.push("/");
      return;
    }
    
    const name = localStorage.getItem("currentStudentName");
    if (name) setStudentName(name);

    const shuffleArray = (array: any[]) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // 2. Fetch assessment and student session simultaneously
    const initialize = async () => {
      try {
        const [assessmentData, sessionRes] = await Promise.all([
          fetchAssessment(),
          fetch(`/api/assessments/student-session?studentId=${studentId}&code=${code}`).then(r => r.json())
        ]);

        if (!assessmentData) return;
        if (assessmentData.status !== "PUBLISHED") {
          setError("This assessment is closed.");
          setLoading(false);
          return;
        }

        if (sessionRes.isCompleted) {
          setError("You have already completed and submitted this assessment.");
          setLoading(false);
          return;
        }

        const student = sessionRes.student;
        if (!student) {
          setError("Student session not found. Please re-join using your details.");
          setLoading(false);
          return;
        }

        setSessionStatus(student.status);

        // Parse question options
        let parsedQuestions = assessmentData.questions.map((q: any) => ({
          ...q,
          options: q.options ? shuffleArray(JSON.parse(q.options)) : []
        }));

        // Preserve identical question sequence if student previously started
        if (student.questionOrder && Array.isArray(student.questionOrder) && student.questionOrder.length > 0) {
          const orderMap = new Map<string, number>();
          student.questionOrder.forEach((qid: string, idx: number) => orderMap.set(qid, idx));
          parsedQuestions.sort((a: any, b: any) => {
            const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
            const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
            return idxA - idxB;
          });
        } else {
          parsedQuestions = shuffleArray(parsedQuestions);
        }

        setAssessment({ ...assessmentData, questions: parsedQuestions });

        // Restore saved draft answers if any
        if (student.draftAnswers && Object.keys(student.draftAnswers).length > 0) {
          setAnswers(student.draftAnswers);
          setResumeAnswersCount(Object.keys(student.draftAnswers).length);
          setIsResumedSession(true);
        }

        // Restore remaining time
        if (typeof student.timeLeft === "number" && student.timeLeft > 0) {
          setTimeLeft(student.timeLeft);
        } else {
          setTimeLeft(assessmentData.duration * 60);
        }

        // Restore violations count
        if (typeof student.violations === "number") {
          setViolations(student.violations);
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to initialize test session");
        setLoading(false);
      }
    };

    initialize();
  }, [code, router]);

  // Polling for trainer resume approval when status is RESUME_REQUESTED
  useEffect(() => {
    if (sessionStatus !== "RESUME_REQUESTED") return;
    const studentId = localStorage.getItem("currentStudentId");
    if (!studentId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/assessments/resume-action?studentId=${studentId}`);
        const data = await res.json();
        if (data.canResume) {
          setSessionStatus("RESUME_APPROVED");
          setIsResumedSession(true);
        } else if (data.isRejected) {
          setSessionStatus("RESUME_REJECTED");
        }
      } catch (e) {
        console.error("Polling resume status failed:", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionStatus]);

  const lastViolationTime = useRef(0);

  // Tab switch & fullscreen exit (malpractice) tracking
  useEffect(() => {
    if (!assessment || isSubmitted) return;

    const incrementViolation = () => {
      if (!hasStartedExamRef.current || isSubmitting.current) return;
      const now = Date.now();
      if (now - lastViolationTime.current > 2000) {
        lastViolationTime.current = now;
        setViolations(prev => {
          const newCount = prev + 1;
          if (newCount === 1) setShowWarningModal(true);
          return newCount;
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) incrementViolation();
    };

    const handleBlur = () => {
      incrementViolation();
    };

    const handleFullscreenChange = () => {
      const doc = document as any;
      const isStillFullscreen = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      if (!isStillFullscreen) {
        setIsFullscreen(false);
        setPreviewImage(null);
        if (hasStartedExamRef.current && !isSubmitting.current) {
          incrementViolation();
        }
      } else {
        setIsFullscreen(true);
        try {
          if (typeof navigator !== "undefined" && (navigator as any).keyboard?.lock) {
            (navigator as any).keyboard.lock(["Escape"]).catch(() => {});
          }
        } catch (_) {}
      }
    };

    const handleContextMenu = (e: Event) => e.preventDefault();
    const handleCopyPaste = (e: Event) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          e.preventDefault();
          e.stopPropagation();
          setPreviewImage(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [assessment, isSubmitted, previewImage]);

  // Auto-submit on 2nd violation
  useEffect(() => {
    if (violations >= 2 && !isSubmitted) {
      handleSubmitTest();
    }
  }, [violations, isSubmitted]);

  // Polling for assessment status changes
  useEffect(() => {
    if (!assessment || isSubmitted) return;
    
    const interval = setInterval(async () => {
      const updated = await fetchAssessment();
      if (updated && updated.status !== "PUBLISHED") {
        clearInterval(interval);
        alert("The trainer has closed this assessment. Auto-submitting your test.");
        handleSubmitTest();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [assessment, isSubmitted]);

  // Timer logic
  useEffect(() => {
    if (!assessment || timeLeft <= 0 || isSubmitted || !hasStartedExam || sessionStatus === "RESUME_REQUESTED") return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [assessment, timeLeft, isSubmitted, hasStartedExam, sessionStatus]);

  const saveSession = async (currentAnswers: any, currentTimeLeft: number, currentViolations: number, forceHasStarted?: boolean) => {
    const studentId = localStorage.getItem("currentStudentId");
    if (!studentId || !assessment || isSubmitting.current || isSubmitted) return;

    try {
      const questionOrder = assessment.questions.map((q: any) => q.id);
      const res = await fetch("/api/assessments/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          assessmentId: assessment.id,
          draftAnswers: currentAnswers,
          questionOrder,
          timeLeft: currentTimeLeft,
          violations: currentViolations,
          hasStarted: forceHasStarted ?? hasStartedExamRef.current
        })
      });
      const data = await res.json();
      if (data.status === "RESUME_REJECTED") {
        setSessionStatus("RESUME_REJECTED");
      }
    } catch (e) {
      console.error("Auto-save session error:", e);
    }
  };

  // Periodic auto-save heartbeat every 12 seconds
  useEffect(() => {
    if (!assessment || isSubmitted || !hasStartedExam || sessionStatus === "RESUME_REQUESTED") return;

    const interval = setInterval(() => {
      saveSession(answersRef.current, timeLeftRef.current, violationsRef.current);
    }, 12000);

    return () => clearInterval(interval);
  }, [assessment, isSubmitted, hasStartedExam, sessionStatus]);

  // Debounced auto-save on answer change
  useEffect(() => {
    if (!assessment || isSubmitted || !hasStartedExam) return;

    const timeout = setTimeout(() => {
      saveSession(answers, timeLeftRef.current, violationsRef.current);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [answers, hasStartedExam]);

  const requestFullscreen = () => {
    hasStartedExamRef.current = true;
    setHasStartedExam(true);
    setSessionStatus("IN_PROGRESS");
    const el = document.documentElement as any;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) {
      req.call(el).then(() => {
        setIsFullscreen(true);
      }).catch((err: any) => {
        console.error("Fullscreen request failed:", err);
        setIsFullscreen(true);
      });
    } else {
      setIsFullscreen(true);
    }
    saveSession(answersRef.current, timeLeftRef.current, violationsRef.current, true);
  };

  const handleSubmitTest = async () => {
    if (isSubmitting.current || isSubmitted) return;
    
    const studentId = localStorage.getItem("currentStudentId");
    if (!studentId || !assessment) return;

    isSubmitting.current = true;

    const finalAnswers = { ...answers };
    for (const q of assessment.questions) {
      if (q.type === 'CODING' && finalAnswers[q.id]) {
        const lang = selectedLanguage[q.id] || q.language || "Python";
        finalAnswers[q.id] = `[Language: ${lang}]\n${finalAnswers[q.id]}`;
      }
    }

    try {
      setIsSubmittingState(true);
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          assessmentId: assessment.id,
          answers: finalAnswers,
          violations
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (data.result && data.result.details) {
        try {
          setSubmissionResult(JSON.parse(data.result.details));
        } catch (e) {
          console.error("Failed to parse result details");
        }
      }

      setIsSubmitted(true);
      localStorage.removeItem("currentStudentId");
    } catch (err: any) {
      alert("Error submitting test: " + err.message);
      isSubmitting.current = false;
    } finally {
      setIsSubmittingState(false);
      setLoading(false);
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
        if (doc.exitFullscreen) doc.exitFullscreen().catch(console.error);
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
      }
    }
  };

  const scrollToQuestion = (id: string) => {
    const el = document.getElementById(`question-card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (isSubmittingState) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 flex-col p-4 text-center text-white">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-black mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Submitting Your Assessment...
        </h2>
        <p className="text-slate-400 max-w-md text-sm">
          Auto-evaluating your answers and recording results with the trainer. Please do not close or refresh this tab.
        </p>
      </div>
    );
  }

  if (loading && !isSubmitted) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white flex-col">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-sm font-semibold">Loading Test Session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white p-4">
        <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-8 max-w-md text-center">
          <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Access Notice</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (isSubmitted && assessment) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 flex justify-center items-start overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-12 rounded-3xl shadow-2xl w-full max-w-3xl text-center my-8">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-emerald-500/30">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Besant Technologies Mock Exams
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-1 mb-3">
            Assessment Completed!
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto mb-8">
            Your responses have been successfully recorded and submitted to your trainer for evaluation.
          </p>
          
          {submissionResult && (
            <div className="text-left border-t border-slate-800 pt-8 w-full">
              <h3 className="text-lg font-bold mb-4 text-white text-center">Score Summary</h3>
              <div className="space-y-4">
                {assessment.questions.map((q: any, i: number) => {
                  const res = submissionResult[q.id];
                  if (!res) return null;
                  
                  return (
                    <div key={q.id} className={`p-5 rounded-2xl border ${res.isCorrect ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/30 border-rose-500/40 text-rose-200'}`}>
                      <p className="font-bold text-white mb-2">
                        <span className="text-indigo-400 mr-2">Q{i + 1}.</span> {q.text}
                      </p>
                      <div className="text-xs space-y-2 mt-3">
                        {!res.isCorrect && res.feedback && (
                          <p className="pt-2 text-slate-300">
                            <span className="font-bold text-slate-400">AI Feedback:</span> {res.feedback}
                          </p>
                        )}
                        
                        <div className={`font-bold mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between ${res.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span>{res.isCorrect ? '✅ Correct' : '❌ Wrong'}</span>
                          <span>{res.awardedMarks} / {q.marks} Marks</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8">
            <button 
              onClick={() => router.push("/")} 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-8 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30"
            >
              Return to Home Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showWarningModal) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border-2 border-rose-500 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-lg text-center text-white">
          <div className="text-rose-500 mb-5 flex justify-center">
            <svg className="w-20 h-20 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Malpractice Violation
          </span>
          <h2 className="text-3xl font-black text-rose-400 mt-3 mb-3">FINAL WARNING</h2>
          <p className="text-slate-300 text-sm font-medium mb-6 leading-relaxed">
            Tab switching or leaving full-screen mode is <span className="font-bold underline text-white">strictly prohibited</span>. This is your 1st recorded warning. Doing this again will instantly and permanently submit your test!
          </p>
          <button 
            onClick={() => {
              setShowWarningModal(false);
              requestFullscreen();
            }}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold rounded-xl text-base shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5"
          >
            I Understand, Return to Exam
          </button>
        </div>
      </div>
    );
  }

  if (sessionStatus === "RESUME_REJECTED") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-rose-500/30 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center text-white">
          <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 px-3 py-1 rounded-full">
            Resume Declined
          </span>
          <h2 className="text-2xl font-black text-white mt-4 mb-2">Resume Not Allowed</h2>
          <p className="text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed">
            Your request to resume this exam session was declined by the trainer. You cannot continue this test.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem("currentStudentId");
              router.push("/");
            }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
          >
            Return to Home Portal
          </button>
        </div>
      </div>
    );
  }

  if (sessionStatus === "RESUME_REQUESTED") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-amber-500/30 p-8 sm:p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center text-white">
          <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-400 animate-pulse border border-amber-500/30">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full">
            Session Interrupted
          </span>
          <h2 className="text-2xl font-black text-white mt-4 mb-2">Trainer Approval Required</h2>
          <p className="text-slate-400 text-xs sm:text-sm mb-5 leading-relaxed">
            Your exam session was paused due to a power-off, battery down, or network disconnection. All your previous answers and remaining time are safely stored.
          </p>

          <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 mb-5 text-left space-y-2 text-xs text-slate-300 font-medium">
            <div className="flex justify-between">
              <span className="text-slate-400">Candidate:</span>
              <span className="font-bold text-white">{studentName || "You"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Saved Answers:</span>
              <span className="font-bold text-emerald-400">✅ {resumeAnswersCount} questions preserved</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Remaining Time:</span>
              <span className="font-bold text-indigo-400">⏱️ {Math.floor(timeLeft / 60)}m {timeLeft % 60}s</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-2 text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 py-2.5 px-4 rounded-xl mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>Waiting for trainer to click &quot;Allow Resume&quot;...</span>
          </div>

          <p className="text-[11px] text-slate-500">
            This screen will automatically resume into your exam as soon as your trainer approves. You do not need to refresh.
          </p>
        </div>
      </div>
    );
  }

  // Not in full-screen screen (Start Prompt / Resume Prompt)
  if (!isFullscreen) {
    const hasStarted = hasStartedExam || hasStartedExamRef.current;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden text-white">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>

        <div className={`bg-slate-900/85 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center border-2 ${
          hasStarted ? 'border-rose-500 shadow-rose-900/30' : isResumedSession ? 'border-emerald-500 shadow-emerald-900/30' : 'border-slate-700/80'
        } relative z-10`}>
          {hasStarted && (
            <div className="text-rose-500 mb-4 flex justify-center">
              <svg className="w-16 h-16 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          )}
          {isResumedSession && !hasStarted && (
            <div className="text-emerald-400 mb-4 flex justify-center">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}

          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">
            Besant Technologies Mock Exams
          </h2>

          <h1 className="text-2xl sm:text-3xl font-black mb-3 text-white">
            {hasStarted 
              ? "Full-Screen Exited! (Malpractice Logged)" 
              : isResumedSession 
                ? "Resume Approved by Trainer! ✅" 
                : assessment.title}
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm mb-6 leading-relaxed">
            {hasStarted 
              ? "You have exited full-screen mode. Leaving full-screen or switching windows is strictly prohibited and has been recorded as a malpractice violation. If you leave full-screen again, your test will be permanently submitted immediately." 
              : isResumedSession
                ? `Your trainer has approved your test continuation. Your ${resumeAnswersCount} saved answers and remaining time have been restored. Click below to enter full-screen and resume your exam.`
                : "This assessment requires full-screen mode to ensure academic integrity. Once you enter full-screen, the timer will begin."}
          </p>

          {isResumedSession && !hasStarted && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 p-4 rounded-2xl mb-6 text-xs text-left">
              <div className="font-bold mb-1.5 text-white">Restored Session Details:</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Saved Answers: {resumeAnswersCount} questions preserved</li>
                <li>Time Remaining: {Math.floor(timeLeft / 60)}m {timeLeft % 60}s</li>
                <li>Recorded Malpractice Violations: {violations}</li>
              </ul>
            </div>
          )}

          {!hasStarted && !isResumedSession && (
            <div className="bg-slate-950/60 border border-slate-800 text-slate-300 p-4 rounded-2xl mb-6 text-xs text-left space-y-1.5">
              <div className="font-bold text-white mb-1">Assessment Rules:</div>
              <div className="flex items-center gap-2">
                <span>⏱️</span>
                <span>Duration: {assessment.duration} minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🔒</span>
                <span>Do not exit full-screen mode or switch tabs.</span>
              </div>
              <div className="flex items-center gap-2">
                <span>💾</span>
                <span>Answers auto-save every few seconds to prevent loss.</span>
              </div>
            </div>
          )}

          <button 
            onClick={requestFullscreen}
            className={`font-black py-3 px-8 rounded-xl w-full transition text-sm text-white shadow-xl ${
              hasStarted 
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30' 
                : isResumedSession 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30' 
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {hasStarted 
              ? "I Understand, Return to Full-Screen" 
              : isResumedSession 
                ? "Enter Full-Screen to Resume Test" 
                : "Enter Full-Screen & Start Test"}
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = assessment.questions.length;
  const progressPercent = Math.min(100, Math.round((answeredCount / (totalQuestions || 1)) * 100));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col relative text-slate-900 select-none">
      {/* Assessment Header Toolbar */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
            BT
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
              {assessment.title}
            </h1>
            {studentName && (
              <p className="text-xs text-slate-500 font-medium">
                Candidate: <span className="text-indigo-700 font-bold">{studentName}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Live Timer Pill */}
          <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm sm:text-base shadow-sm border transition-all ${
            timeLeft < 120 
              ? 'bg-rose-600 text-white border-rose-700 animate-pulse' 
              : timeLeft < 300 
                ? 'bg-amber-500 text-white border-amber-600 animate-pulse' 
                : 'bg-slate-900 text-white border-slate-800'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button 
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/40 transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Submit Test
          </button>
        </div>
      </header>

      {/* Interactive Question Jump Palette / Ribbon */}
      <div className="bg-slate-900 text-white px-4 sm:px-8 py-2.5 sticky top-[61px] z-20 flex flex-wrap items-center justify-between gap-3 shadow-md border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <span className="hidden sm:inline">Jump to Question:</span>
          <span className="text-slate-400 font-normal">({answeredCount}/{totalQuestions} Answered • {progressPercent}%)</span>
        </div>

        {/* Scrollable Question Number Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 max-w-full">
          {assessment.questions.map((q: any, i: number) => {
            const isAnswered = !!answers[q.id];
            return (
              <button
                key={q.id}
                onClick={() => scrollToQuestion(q.id)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center shrink-0 ${
                  isAnswered
                    ? 'bg-emerald-500 text-white ring-1 ring-emerald-300 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
                title={`Question ${i + 1} (${isAnswered ? "Answered" : "Unanswered"})`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Overall Gradient Progress Bar */}
      <div className="w-full bg-slate-200 h-1.5 sticky top-[106px] z-20">
        <div 
          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 h-1.5 transition-all duration-300 ease-out" 
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* Questions Scroll View */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
          {assessment.questions.map((q: any, index: number) => (
            <div 
              key={q.id} 
              id={`question-card-${q.id}`}
              className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/90 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>

              <div className="flex justify-between items-start mb-5 gap-3">
                <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed flex-1">
                  <span className="text-indigo-600 font-black mr-2 text-lg sm:text-xl">Q{index + 1}.</span> 
                  <span className="whitespace-pre-wrap font-sans font-bold">{q.text}</span>
                </div>
                <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-3 py-1 rounded-full whitespace-nowrap ml-2">
                  {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                </span>
              </div>

              {/* Optional Reference Diagram for MCQ */}
              {q.type === 'MCQ' && q.imageUrl && (
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                      <svg className="w-4 h-4 mr-1.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Reference Diagram
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(q.imageUrl)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg transition"
                    >
                      🔍 Click to Zoom In
                    </button>
                  </div>
                  <div 
                    className="flex justify-center bg-white rounded-xl border border-slate-200 p-2 overflow-hidden cursor-pointer group"
                    onClick={() => setPreviewImage(q.imageUrl)}
                    title="Click to zoom in"
                  >
                    <img
                      src={q.imageUrl}
                      alt="Question reference"
                      className="max-h-80 w-auto object-contain rounded-lg group-hover:scale-[1.01] transition-transform"
                    />
                  </div>
                </div>
              )}

              {/* MCQ Options with vibrant active state */}
              {q.type === 'MCQ' ? (
                <div className="space-y-3 mt-4">
                  {q.options.map((opt: string, i: number) => {
                    const isSelected = answers[q.id] === opt;
                    return (
                      <label 
                        key={i} 
                        className={`flex items-center p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? 'border-indigo-600 bg-gradient-to-r from-indigo-50/90 to-purple-50/50 shadow-sm ring-2 ring-indigo-200' 
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${
                          isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </div>
                        <input 
                          type="radio" 
                          name={`question-${q.id}`} 
                          value={opt}
                          checked={isSelected}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          className="hidden"
                        />
                        <span className={`text-sm sm:text-base ${isSelected ? 'text-indigo-950 font-bold' : 'text-slate-700'}`}>
                          {opt}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                /* Code / SQL Query Editor */
                <div className="mt-4 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                  <div className="flex justify-between items-center px-4 py-3 bg-slate-900 border-b border-slate-800 flex-wrap gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1.5">
                        <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      </div>
                      <span className="text-xs font-semibold text-slate-400">
                        {(selectedLanguage[q.id] || q.language || "Python").toUpperCase()} Query Editor
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      {q.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setShowSchemaInEditor(prev => ({ ...prev, [q.id]: prev[q.id] === false ? true : false }))}
                          className={`text-xs font-bold px-3 py-1 rounded-lg border transition flex items-center space-x-1.5 ${
                            showSchemaInEditor[q.id] !== false
                              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                          title="Toggle Table Schema view in editor"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{showSchemaInEditor[q.id] !== false ? "Hide Table Schema" : "Show Table Schema"}</span>
                        </button>
                      )}
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Language:</span>
                      <select 
                        value={selectedLanguage[q.id] || q.language || "Python"} 
                        onChange={(e) => setSelectedLanguage(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="text-xs font-bold text-white bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer appearance-none"
                      >
                        <option value="Python">Python</option>
                        <option value="Java">Java</option>
                        <option value="SQL">SQL</option>
                        <option value="C++">C++</option>
                        <option value="JavaScript">JavaScript</option>
                      </select>
                    </div>
                  </div>

                  {/* Reflected Table Schema inside Query Editor */}
                  {q.imageUrl && showSchemaInEditor[q.id] !== false && (
                    <div className="bg-slate-950 border-b border-slate-800 p-3">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-400">
                          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Table Schema Reference</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedSchema(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                          className="text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-700 transition"
                        >
                          {expandedSchema[q.id] ? "↕ Compact Height" : "↕ Expand Height"}
                        </button>
                      </div>
                      <div 
                        className={`bg-black/60 rounded-xl p-2 border border-slate-800 overflow-auto flex justify-center transition-all duration-200 ${expandedSchema[q.id] ? 'max-h-[520px]' : 'max-h-60'}`}
                      >
                        <img
                          src={q.imageUrl}
                          alt="SQL Table Reference"
                          className={`${expandedSchema[q.id] ? 'max-h-[500px]' : 'max-h-56'} w-auto object-contain rounded-lg transition-all`}
                        />
                      </div>
                    </div>
                  )}

                  <textarea
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const value = target.value;
                        const newValue = value.substring(0, start) + "    " + value.substring(end);
                        setAnswers(prev => ({ ...prev, [q.id]: newValue }));
                        setTimeout(() => { target.selectionStart = target.selectionEnd = start + 4; }, 0);
                      }
                    }}
                    className="w-full h-64 p-5 font-mono text-xs sm:text-sm bg-transparent text-slate-100 outline-none resize-y placeholder-slate-600 leading-relaxed"
                    placeholder="// Write your solution here..."
                    spellCheck="false"
                  ></textarea>

                  <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col items-end">
                    <button 
                      onClick={async () => {
                        const lang = selectedLanguage[q.id] || q.language || "Python";
                        const code = answers[q.id];
                        if (!code) return;
                        
                        setRunOutputs(prev => ({ ...prev, [q.id]: "Compiling and running..." }));
                        setIsRunning(prev => ({ ...prev, [q.id]: true }));
                        
                        try {
                          const res = await fetch("/api/run-code", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ 
                              code, 
                              language: lang, 
                              questionText: q.text,
                              imageUrl: q.imageUrl 
                            })
                          });
                          const data = await res.json();
                          setRunOutputs(prev => ({ ...prev, [q.id]: data.output || "No output." }));
                        } catch (e) {
                          setRunOutputs(prev => ({ ...prev, [q.id]: "Error running code." }));
                        }
                        setIsRunning(prev => ({ ...prev, [q.id]: false }));
                      }}
                      disabled={isRunning[q.id] || !answers[q.id]}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-md shadow-indigo-600/30 disabled:opacity-50 flex items-center space-x-2"
                    >
                      {isRunning[q.id] ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <span>{isRunning[q.id] ? "Running..." : "Run Code"}</span>
                    </button>

                    {runOutputs[q.id] && (
                      <div className="mt-4 w-full bg-black text-emerald-400 p-5 rounded-2xl font-mono text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap text-left border border-slate-800 shadow-inner">
                        <div className="flex items-center space-x-2 text-slate-500 text-xs mb-3 uppercase tracking-wider font-bold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Terminal Output</span>
                        </div>
                        {runOutputs[q.id]}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Custom Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-slate-200">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Submit Early?</h2>
            <p className="text-slate-600 text-xs sm:text-sm mb-6 leading-relaxed">
              You have answered <span className="font-bold text-indigo-600">{answeredCount} of {totalQuestions}</span> questions. Are you sure you want to finalize your submission? You cannot undo this.
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => setShowSubmitConfirm(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition"
              >
                Continue Test
              </button>
              <button 
                onClick={() => {
                  setShowSubmitConfirm(false);
                  handleSubmitTest();
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl text-xs hover:from-emerald-700 hover:to-teal-700 transition shadow-md shadow-emerald-600/20"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe In-Page Lightbox for Table Schema */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-5xl w-full max-h-[92vh] bg-white rounded-3xl p-6 shadow-2xl overflow-auto flex flex-col cursor-default border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <span className="font-black text-slate-900 text-sm">Reference SQL Table / Diagram</span>
              </div>
              <button 
                onClick={() => setPreviewImage(null)}
                className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-xl transition shadow flex items-center space-x-1.5"
              >
                <span>✕ Close Preview</span>
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-2.5 rounded-xl mb-3 flex items-center space-x-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Click the red <strong>&quot;✕ Close Preview&quot;</strong> button or click outside this box to return. <strong>Do NOT press the Escape key</strong>.</span>
            </div>

            <div className="flex justify-center items-center overflow-auto flex-1 p-2 bg-slate-50 rounded-2xl border border-slate-100">
              <img 
                src={previewImage} 
                alt="Enlarged Reference Table" 
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-sm"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setPreviewImage(null)}
                className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-xl transition"
              >
                Done / Back to Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
