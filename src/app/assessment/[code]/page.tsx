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
      // Only count one violation every 2 seconds to prevent blur and visibilitychange firing together and double-counting
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
        setPreviewImage(null); // Close any open image modal immediately
        // If the student has already started the test, exiting fullscreen is a STRICT MALPRACTICE VIOLATION!
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
    
    // Anti-cheat protections
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
  }, [assessment, isSubmitted]);

  // Auto-submit on 2nd violation
  useEffect(() => {
    if (violations >= 2 && !isSubmitted) {
      handleSubmitTest();
    }
  }, [violations, isSubmitted, answers, assessment]);

  // Polling for assessment status changes (auto-submit if closed)
  useEffect(() => {
    if (!assessment || isSubmitted) return;
    
    const interval = setInterval(async () => {
      const updated = await fetchAssessment();
      if (updated && updated.status !== "PUBLISHED") {
        clearInterval(interval);
        alert("The trainer has closed this assessment. Auto-submitting your test.");
        handleSubmitTest();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [assessment, isSubmitted, answers, violations]);

  // Timer logic: only counts down when exam has actively started, student is in fullscreen/active, and not pending approval
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

  // Debounced auto-save whenever answers change (within 1.5 seconds)
  useEffect(() => {
    if (!assessment || isSubmitted || !hasStartedExam) return;

    const timeout = setTimeout(() => {
      saveSession(answers, timeLeftRef.current, violationsRef.current);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [answers]);

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
    // Immediately persist start state to database
    saveSession(answersRef.current, timeLeftRef.current, violationsRef.current, true);
  };

  const handleSubmitTest = async () => {
    if (isSubmitting.current || isSubmitted) return;
    
    const studentId = localStorage.getItem("currentStudentId");
    if (!studentId || !assessment) return;

    isSubmitting.current = true;

    // Inject the selected language into the student's answer before submitting
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

  if (isSubmittingState) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col p-4 text-center">
        <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitting Your Test...</h2>
        <p className="text-gray-600 max-w-md">Saving your answers and recording results with the trainer. Please do not close or refresh this tab.</p>
      </div>
    );
  }

  if (loading && !isSubmitted) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;

  if (isSubmitted && assessment) {
    return (
      <div className="flex h-screen bg-gray-50 p-4 justify-center items-start overflow-y-auto pt-12">
        <div className="bg-white p-8 md:p-12 rounded-xl shadow-lg w-full max-w-3xl text-center border border-gray-200 mb-12">
          <div className="text-green-500 mb-6">
            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-extrabold text-blue-600 mb-1">Besant Technologies Mock Exams</h2>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Test Completed!</h1>
          <p className="text-gray-600 mb-8">
            Your responses have been successfully saved and submitted to the trainer for evaluation.
          </p>
          
          {submissionResult && (
            <div className="mt-8 text-left border-t pt-8 w-full">
              <h3 className="text-xl font-bold mb-4 text-gray-900 text-center">Your Results</h3>
              <div className="space-y-4">
                {assessment.questions.map((q: any, i: number) => {
                  const res = submissionResult[q.id];
                  if (!res) return null;
                  
                  return (
                    <div key={q.id} className={`p-4 rounded-lg border ${res.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="font-medium text-gray-900 mb-2"><span className="font-bold">Q{i + 1}.</span> {q.text}</p>
                      <div className="text-sm space-y-2 mt-3">
                        {!res.isCorrect && res.feedback && (
                          <p className="pt-2"><span className="font-semibold text-gray-700">Feedback:</span> <span className="text-gray-800">{res.feedback}</span></p>
                        )}
                        
                        <div className={`font-bold mt-2 pt-2 border-t ${res.isCorrect ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}>
                          {res.isCorrect ? '✅ Correct' : '❌ Wrong'} ({res.awardedMarks}/{q.marks} Marks)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-10">
            <button 
              onClick={() => router.push("/")} 
              className="bg-blue-600 text-white font-medium py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors w-full md:w-auto shadow-md"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showWarningModal) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-lg text-center border-4 border-red-500">
          <div className="text-red-600 mb-6 flex justify-center">
            <svg className="w-24 h-24 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-4xl font-extrabold text-red-600 mb-4">WARNING</h2>
          <p className="text-gray-800 text-lg font-medium mb-8 leading-relaxed">
            Tab switching or leaving full-screen mode is <span className="font-bold underline">strictly prohibited</span>! This is your final warning. Doing this again will automatically submit your test and mark it as malpractice.
          </p>
          <button 
            onClick={() => {
              setShowWarningModal(false);
              requestFullscreen();
            }}
            className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            I Understand, Resume Test
          </button>
        </div>
      </div>
    );
  }

  if (sessionStatus === "RESUME_REJECTED") {
    return (
      <div className="flex h-screen items-center justify-center bg-rose-50 p-4">
        <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl max-w-lg w-full text-center border-2 border-rose-300">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-5 text-rose-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 px-3 py-1 rounded-full">
            Resume Declined
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-4 mb-2">Resume Not Allowed</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Your request to resume this exam session was declined by the trainer. You cannot continue this test.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem("currentStudentId");
              router.push("/");
            }}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition shadow-md"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (sessionStatus === "RESUME_REQUESTED") {
    return (
      <div className="flex h-screen items-center justify-center bg-amber-50/60 p-4">
        <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl max-w-lg w-full text-center border-2 border-amber-300">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5 text-amber-600 animate-pulse">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
            Session Interrupted
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-4 mb-2">Trainer Approval Required</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Your exam session was paused due to a power-off, battery down, or network disconnection. All your previous answers and remaining time are safely stored.
          </p>

          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 mb-6 text-left space-y-2 text-xs text-amber-950 font-medium">
            <div className="flex justify-between">
              <span className="text-amber-700">Student:</span>
              <span className="font-bold">{studentName || "You"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-700">Saved Answers:</span>
              <span className="font-bold text-emerald-700">{resumeAnswersCount} questions answered</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-700">Remaining Time:</span>
              <span className="font-bold text-indigo-700">{Math.floor(timeLeft / 60)}m {timeLeft % 60}s</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-2 text-xs font-bold text-amber-800 bg-amber-100/70 py-2.5 px-4 rounded-lg mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
            <span>Waiting for trainer to click &quot;Allow Resume&quot;...</span>
          </div>

          <p className="text-xs text-slate-400">
            This screen will automatically resume into your exam as soon as your trainer approves. You do not need to refresh.
          </p>
        </div>
      </div>
    );
  }

  if (!isFullscreen) {
    const hasStarted = hasStartedExam || hasStartedExamRef.current;
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <div className={`bg-white p-8 rounded-xl shadow-lg max-w-lg text-center border-2 ${hasStarted ? 'border-red-500 shadow-red-100' : isResumedSession ? 'border-emerald-500 shadow-emerald-100' : 'border-gray-200'}`}>
          {hasStarted && (
            <div className="text-red-600 mb-4 flex justify-center">
              <svg className="w-16 h-16 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          )}
          {isResumedSession && !hasStarted && (
            <div className="text-emerald-600 mb-4 flex justify-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
          <h2 className="text-xl font-extrabold text-blue-600 mb-2">Besant Technologies Mock Exams</h2>
          <h1 className="text-2xl font-bold mb-4">
            {hasStarted 
              ? "Full-Screen Exited! (Malpractice Logged)" 
              : isResumedSession 
                ? "Resume Approved by Trainer! ✅" 
                : assessment.title}
          </h1>
          <p className="text-gray-600 mb-6">
            {hasStarted 
              ? "You have exited full-screen mode. Leaving full-screen or switching windows is strictly prohibited and has been recorded as a malpractice violation. If you leave full-screen again, your test will be permanently submitted immediately." 
              : isResumedSession
                ? `Your trainer has approved your test continuation. Your ${resumeAnswersCount} saved answers and remaining time have been restored. Click below to enter full-screen and resume your exam.`
                : "This assessment requires full-screen mode to ensure academic integrity. Once you enter full-screen, the timer will begin."}
          </p>
          {isResumedSession && !hasStarted && (
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-6 text-sm text-left border border-emerald-200">
              <div className="font-bold mb-1">Restored Session Details:</div>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>Saved Answers: {resumeAnswersCount} questions preserved</li>
                <li>Time Remaining: {Math.floor(timeLeft / 60)}m {timeLeft % 60}s</li>
                <li>Recorded Malpractice Violations: {violations}</li>
              </ul>
            </div>
          )}
          {!hasStarted && !isResumedSession && (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-md mb-6 text-sm text-left">
              <ul className="list-disc pl-5 space-y-2">
                <li>Duration: {assessment.duration} minutes</li>
                <li>Do not exit full-screen mode or switch tabs.</li>
                <li>Your test will auto-submit when the timer ends.</li>
              </ul>
            </div>
          )}
          <button 
            onClick={requestFullscreen}
            className={`font-bold py-3 px-8 rounded-lg w-full transition text-white ${
              hasStarted 
                ? 'bg-red-600 hover:bg-red-700 shadow-lg' 
                : isResumedSession 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-md'
            }`}
          >
            {hasStarted 
              ? "I Understand, Return to Full-Screen" 
              : isResumedSession 
                ? "Enter Full-Screen to Resume Test" 
                : "Enter Full-Screen & Start"}
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col relative">
      {/* Assessment Header Toolbar */}
      <header className="bg-white shadow-sm px-6 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-20">
        <div className="flex-1 w-full md:w-auto flex flex-col">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{assessment.title}</h1>
          {studentName && <p className="text-sm text-gray-500 font-medium mt-1">Candidate: <span className="text-gray-900 font-bold bg-gray-100 px-2 py-0.5 rounded">{studentName}</span></p>}
        </div>
        <div className="flex-1 text-center my-4 md:my-0">
           <h2 className="text-lg font-extrabold text-blue-600 uppercase tracking-widest">Besant Technologies</h2>
        </div>
        <div className="flex-1 w-full md:w-auto flex items-center justify-end space-x-6">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-mono font-bold text-lg shadow-sm border ${timeLeft < 300 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-gray-50 text-gray-900 border-gray-200'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{formatTime(timeLeft)}</span>
          </div>
          <button 
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            Submit Test
          </button>
        </div>
      </header>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 h-1.5 sticky top-[88px] z-10">
        <div 
          className="bg-blue-600 h-1.5 transition-all duration-500 ease-out" 
          style={{ width: `${(Object.keys(answers).length / assessment.questions.length) * 100}%` }}
        ></div>
      </div>

      {/* Questions Scroll View */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-10 pb-20">
          {assessment.questions.map((q: any, index: number) => (
            <div key={q.id} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <div className="flex justify-between items-start mb-6">
                <div className="text-lg font-medium text-gray-900 leading-relaxed flex-1">
                  <span className="text-blue-600 font-bold mr-2 text-xl">Q{index + 1}.</span> 
                  <span className="whitespace-pre-wrap font-sans">{q.text}</span>
                </div>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full whitespace-nowrap ml-4">
                  {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                </span>
              </div>

              {/* Optional Reference Diagram for MCQ questions only (Coding/SQL questions reflect table inside query editor) */}
              {q.type === 'MCQ' && q.imageUrl && (
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                      <svg className="w-4 h-4 mr-1.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Reference Diagram
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(q.imageUrl)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded transition"
                    >
                      🔍 Click to Zoom In
                    </button>
                  </div>
                  <div 
                    className="flex justify-center bg-white rounded-lg border border-slate-200 p-2 overflow-hidden cursor-pointer group"
                    onClick={() => setPreviewImage(q.imageUrl)}
                    title="Click to zoom in"
                  >
                    <img
                      src={q.imageUrl}
                      alt="Question reference"
                      className="max-h-80 w-auto object-contain rounded group-hover:scale-[1.01] transition-transform"
                    />
                  </div>
                </div>
              )}

              {q.type === 'MCQ' ? (
                <div className="space-y-3 mt-4">
                  {q.options.map((opt: string, i: number) => {
                    const isSelected = answers[q.id] === opt;
                    return (
                      <label key={i} className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${isSelected ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}>
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
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
                        <span className={`text-base ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-inner">
                  <div className="flex justify-between items-center px-4 py-3 bg-gray-950 border-b border-gray-800 flex-wrap gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                      </div>
                      <span className="text-xs font-semibold text-gray-400">
                        {(selectedLanguage[q.id] || q.language || "Python").toUpperCase()} Query Editor
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {q.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setShowSchemaInEditor(prev => ({ ...prev, [q.id]: prev[q.id] === false ? true : false }))}
                          className={`text-xs font-semibold px-2.5 py-1 rounded border transition flex items-center space-x-1.5 ${
                            showSchemaInEditor[q.id] !== false
                              ? 'bg-blue-600/30 text-blue-300 border-blue-500/50 hover:bg-blue-600/40'
                              : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                          }`}
                          title="Toggle Table Schema view in editor"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          <span>{showSchemaInEditor[q.id] !== false ? "📊 Hide Table Schema" : "📊 Show Table Schema"}</span>
                        </button>
                      )}
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Language:</span>
                      <select 
                        value={selectedLanguage[q.id] || q.language || "Python"} 
                        onChange={(e) => setSelectedLanguage(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="text-xs font-bold text-white bg-gray-800 border border-gray-700 rounded px-3 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer appearance-none"
                      >
                        <option value="Python">Python</option>
                        <option value="Java">Java</option>
                        <option value="SQL">SQL</option>
                        <option value="C++">C++</option>
                        <option value="JavaScript">JavaScript</option>
                      </select>
                    </div>
                  </div>

                  {/* Reflected Table Schema directly inside the Query Editor */}
                  {q.imageUrl && showSchemaInEditor[q.id] !== false && (
                    <div className="bg-gray-950/90 border-b border-gray-800 p-3">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span>Table Schema & Sample Data Reference</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setExpandedSchema(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                            className="text-[11px] font-bold bg-gray-800 text-gray-300 border border-gray-700 px-2.5 py-1 rounded hover:bg-gray-700 transition"
                            title="Expand or compact image container"
                          >
                            {expandedSchema[q.id] ? "↕ Compact Height" : "↕ Expand Height"}
                          </button>
                        </div>
                      </div>
                      <div 
                        className={`bg-black/60 rounded-lg p-2 border border-gray-800 overflow-auto flex justify-center transition-all duration-200 ${expandedSchema[q.id] ? 'max-h-[520px]' : 'max-h-60'}`}
                      >
                        <img
                          src={q.imageUrl}
                          alt="SQL Table Reference"
                          className={`${expandedSchema[q.id] ? 'max-h-[500px]' : 'max-h-56'} w-auto object-contain rounded transition-all`}
                        />
                      </div>
                      <p className="text-center text-[10px] text-gray-500 mt-1 italic">Use &quot;Expand Height&quot; to view table schema in full size inline.</p>
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
                    className="w-full h-64 p-5 font-mono text-sm bg-transparent text-gray-100 outline-none resize-y placeholder-gray-600 leading-relaxed"
                    placeholder="// Write your solution here..."
                    spellCheck="false"
                  ></textarea>
                  <div className="p-4 bg-gray-950 border-t border-gray-800 flex flex-col items-end">
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
                      className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      {isRunning[q.id] ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      )}
                      <span>{isRunning[q.id] ? "Running..." : "Run Code"}</span>
                    </button>
                    {runOutputs[q.id] && (
                      <div className="mt-4 w-full bg-black text-green-400 p-5 rounded-xl font-mono text-sm overflow-x-auto whitespace-pre-wrap text-left border border-gray-800 shadow-inner">
                        <div className="flex items-center space-x-2 text-gray-500 text-xs mb-3 uppercase tracking-wider font-bold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full text-center">
            <div className="text-yellow-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Submit Early?</h2>
            <p className="text-gray-600 mb-6">
              Are you absolutely sure you want to submit your test? You cannot undo this action.
            </p>
            <div className="flex justify-center space-x-4">
              <button 
                onClick={() => setShowSubmitConfirm(false)}
                className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowSubmitConfirm(false);
                  handleSubmitTest();
                }}
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe In-Page Lightbox for Table Schema (No tab switch / malpractice) */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-5xl w-full max-h-[92vh] bg-white rounded-2xl p-5 shadow-2xl overflow-auto flex flex-col cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2 pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span className="font-bold text-gray-900 text-sm">Reference SQL Table / Dataset</span>
              </div>
              <button 
                onClick={() => setPreviewImage(null)}
                className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition shadow flex items-center space-x-1.5"
              >
                <span>✕ Close Preview</span>
              </button>
            </div>

            {/* Anti-Cheat Notice Banner */}
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3.5 py-2 rounded-lg mb-3 flex items-center space-x-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>Click the red <strong>&quot;✕ Close Preview&quot;</strong> button or click outside this box to return to the editor. <strong>Do NOT press the Escape key</strong> (exiting full-screen is recorded as an exam violation).</span>
            </div>

            <div className="flex justify-center items-center overflow-auto flex-1 p-2 bg-gray-50 rounded-xl border border-gray-100">
              <img 
                src={previewImage} 
                alt="Enlarged Reference Table" 
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>

            <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setPreviewImage(null)}
                className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition"
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
