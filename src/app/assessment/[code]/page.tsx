"use client";

import { useEffect, useState, use } from "react";
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
  
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  // Answers state: mapping question ID to the selected option / typed code
  const [answers, setAnswers] = useState<Record<string, string>>({});

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

    // 2. Initial Fetch
    fetchAssessment().then(assessmentData => {
      if (assessmentData) {
        if (assessmentData.status !== "PUBLISHED") {
          setError("This assessment is closed.");
          setLoading(false);
          return;
        }

        const parsedQuestions = assessmentData.questions.map((q: any) => ({
          ...q,
          options: q.options ? JSON.parse(q.options) : []
        }));
        
        setAssessment({ ...assessmentData, questions: parsedQuestions });
        setTimeLeft(assessmentData.duration * 60);
        setLoading(false);
      }
    });
  }, [code, router]);

  // Tab switch (malpractice) tracking
  useEffect(() => {
    if (!assessment || isSubmitted || !isFullscreen) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolations(prev => {
          const newCount = prev + 1;
          if (newCount === 1) {
            setShowWarningModal(true);
          }
          return newCount;
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // If they exit fullscreen (via ESC or tab switch), force them back to the resume screen
        setIsFullscreen(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [assessment, isSubmitted, isFullscreen]);

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

  // Timer logic
  useEffect(() => {
    if (!assessment || timeLeft <= 0 || isSubmitted) return;
    
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
  }, [assessment, timeLeft, isSubmitted, answers, violations]);

  const requestFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      setIsFullscreen(true); // fallback
    }
  };

  const handleSubmitTest = async () => {
    const studentId = localStorage.getItem("currentStudentId");
    if (!studentId || !assessment) return;

    try {
      setLoading(true);
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          assessmentId: assessment.id,
          answers,
          violations
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setIsSubmitted(true);
    } catch (err: any) {
      alert("Error submitting test: " + err.message);
    } finally {
      setLoading(false);
      localStorage.removeItem("currentStudentId");
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      }
    }
  };

  if (loading && !isSubmitted) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;

  if (isSubmitted && assessment) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-12 rounded-xl shadow-lg max-w-lg text-center border border-gray-200">
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
          <button 
            onClick={() => router.push("/")} 
            className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
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

  if (!isFullscreen) {
    const hasStarted = Object.keys(answers).length > 0;
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg text-center">
          <h2 className="text-xl font-extrabold text-blue-600 mb-2">Besant Technologies Mock Exams</h2>
          <h1 className="text-2xl font-bold mb-4">{assessment.title}</h1>
          <p className="text-gray-600 mb-6">
            {hasStarted 
              ? "You have exited full-screen mode. You must return to full-screen to continue your test." 
              : "This assessment requires full-screen mode to ensure academic integrity. Once you enter full-screen, the timer will begin."}
          </p>
          {!hasStarted && (
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
            className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 w-full"
          >
            {hasStarted ? "Resume Full-Screen" : "Enter Full-Screen & Start"}
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
      <header className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{assessment.title}</h1>
          {studentName && <p className="text-sm text-gray-500 font-medium">Candidate: <span className="text-gray-900 font-bold">{studentName}</span></p>}
        </div>
        <div className="absolute left-1/2 transform -translate-x-1/2 text-center hidden md:block">
           <h2 className="text-xl font-extrabold text-blue-600">Besant Technologies Mock Exams</h2>
        </div>
        <div className="flex-1 flex items-center justify-end space-x-6">
          <div className={`text-xl font-mono font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-gray-900'}`}>
            Time Left: {formatTime(timeLeft)}
          </div>
          <button 
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700"
          >
            Submit Test
          </button>
        </div>
      </header>

      {/* Questions Scroll View */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
          {assessment.questions.map((q: any, index: number) => (
            <div key={q.id} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  <span className="text-blue-600 mr-2">Q{index + 1}.</span> 
                  {q.text}
                </h3>
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                </span>
              </div>

              {q.type === 'MCQ' ? (
                <div className="space-y-3">
                  {q.options.map((opt: string, i: number) => (
                    <label key={i} className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input 
                        type="radio" 
                        name={`question-${q.id}`} 
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Write your code here:</label>
                    {q.language && (
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{q.language}</span>
                    )}
                  </div>
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
                        // Insert 4 spaces
                        const newValue = value.substring(0, start) + "    " + value.substring(end);
                        setAnswers(prev => ({ ...prev, [q.id]: newValue }));
                        
                        // Move cursor right after the inserted spaces (setTimeout needed for React state update)
                        setTimeout(() => {
                          target.selectionStart = target.selectionEnd = start + 4;
                        }, 0);
                      }
                    }}
                    className="w-full h-48 p-4 font-mono text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none resize-y text-gray-900"
                    placeholder="// Your solution..."
                    spellCheck="false"
                  ></textarea>
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
    </div>
  );
}
