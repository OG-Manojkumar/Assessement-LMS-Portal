"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function QuestionBank() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentDuration, setAssessmentDuration] = useState("30");
  const [extractedQuestions, setExtractedQuestions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Manual Question State
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [newQType, setNewQType] = useState("CODING");
  const [newQText, setNewQText] = useState("");
  const [newQMarks, setNewQMarks] = useState("1");
  const [newQLanguage, setNewQLanguage] = useState("Python");
  const [newQCorrect, setNewQCorrect] = useState("");
  const [newQOptions, setNewQOptions] = useState(""); // comma separated
  const [newQImage, setNewQImage] = useState<string | null>(null);
  const [globalSqlTableImage, setGlobalSqlTableImage] = useState<string | null>(null);

  const handleSqlTableUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setGlobalSqlTableImage(dataUrl);
      setExtractedQuestions((prev) =>
        prev.map((q) => {
          const isSql =
            q.language === "SQL" ||
            q.language === "MySQL" ||
            q.text?.toLowerCase().includes("sql") ||
            q.text?.toLowerCase().includes("table");
          if (isSql) {
            return { ...q, imageUrl: dataUrl };
          }
          return q;
        })
      );
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setExtractedQuestions([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract questions");
      }

      const extracted = (data.questions || []).map((q: any) => {
        const isSql =
          q.language === "SQL" ||
          q.language === "MySQL" ||
          q.text?.toLowerCase().includes("sql") ||
          q.text?.toLowerCase().includes("table");
        if (isSql && globalSqlTableImage) {
          return { ...q, imageUrl: globalSqlTableImage };
        }
        return q;
      });

      setExtractedQuestions(extracted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddQuestion = () => {
    if (!newQText || !newQCorrect) return alert("Please fill all required fields");
    
    const isSql =
      newQLanguage === "SQL" ||
      newQLanguage === "MySQL" ||
      newQText.toLowerCase().includes("sql") ||
      newQText.toLowerCase().includes("table");

    const question = {
      type: newQType,
      text: newQText,
      marks: parseInt(newQMarks),
      correctAnswer: newQCorrect,
      language: newQType === "CODING" ? newQLanguage : null,
      options: newQType === "MCQ" ? newQOptions.split(",").map(s => s.trim()).filter(Boolean) : [],
      imageUrl: newQImage || (isSql ? globalSqlTableImage : null)
    };

    if (editIndex !== null) {
      const updated = [...extractedQuestions];
      updated[editIndex] = question;
      setExtractedQuestions(updated);
    } else {
      setExtractedQuestions([...extractedQuestions, question]);
    }
    
    setShowAddModal(false);
    setEditIndex(null);
    setNewQText("");
    setNewQCorrect("");
    setNewQOptions("");
    setNewQImage(null);
  };

  const openEditModal = (idx: number) => {
    const q = extractedQuestions[idx];
    setEditIndex(idx);
    setNewQType(q.type);
    setNewQText(q.text);
    setNewQMarks(q.marks.toString());
    setNewQCorrect(q.correctAnswer);
    setNewQLanguage(q.language || "Python");
    setNewQOptions(q.options ? q.options.join(", ") : "");
    setNewQImage(q.imageUrl || null);
    setShowAddModal(true);
  };

  const deleteQuestion = (idx: number) => {
    if (confirm("Are you sure you want to delete this question?")) {
      const updated = [...extractedQuestions];
      updated.splice(idx, 1);
      setExtractedQuestions(updated);
    }
  };

  const saveAssessment = async () => {
    if (!assessmentTitle) return alert("Please enter a title");
    setIsSaving(true);
    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: assessmentTitle,
          duration: parseInt(assessmentDuration),
          questions: extractedQuestions.map((q) => {
            const isSql =
              q.language === "SQL" ||
              q.language === "MySQL" ||
              q.text?.toLowerCase().includes("sql") ||
              q.text?.toLowerCase().includes("table");
            return {
              ...q,
              imageUrl: q.imageUrl || (isSql ? globalSqlTableImage : null)
            };
          })
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      alert(`Assessment created successfully! Join code: ${data.assessment.joinCode}`);
      router.push("/trainer"); // redirect to dashboard
    } catch (err: any) {
      alert("Error saving: " + err.message);
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Question Bank</h1>
          <p className="text-slate-500 mt-2 font-medium">Manage your extracted questions or upload new ones.</p>
        </div>
      </header>

      {/* Upload Zone & SQL Table Image */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Document Upload */}
        <div className="lg:col-span-2 border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center bg-white hover:bg-slate-50/70 transition-all cursor-pointer relative shadow-sm flex flex-col justify-center">
          <input 
            type="file" 
            accept=".docx,.pdf,.odt" 
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <div className="pointer-events-none">
            <svg className="mx-auto h-12 w-12 text-indigo-500 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="flex text-sm text-gray-700 justify-center font-medium">
              <span className="font-bold text-indigo-600">
                {isUploading ? "Extracting Questions using AI..." : "Upload Questions Document"}
              </span>
              <span className="pl-1">or drag and drop</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">DOCX, PDF, or ODT up to 10MB</p>
          </div>
        </div>

        {/* SQL Table Image Upload (Applicable to all SQL queries) */}
        <div className="border-2 border-dashed border-blue-300 bg-blue-50/40 rounded-2xl p-6 text-center shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-center mb-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
                SQL SCHEMA / TABLE
              </span>
            </div>
            <h3 className="font-bold text-gray-900 text-sm mt-1">Upload SQL Table Picture</h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload 1 table picture here — it will <strong className="text-blue-700">automatically apply to all SQL queries</strong> in this test.
            </p>
          </div>

          <div className="my-3">
            {globalSqlTableImage ? (
              <div className="bg-white p-2.5 rounded-xl border border-blue-200 shadow-sm text-center">
                <img src={globalSqlTableImage} alt="SQL Table schema" className="max-h-28 mx-auto object-contain rounded" />
                <div className="mt-2.5 flex items-center justify-between px-2 pt-1 border-t border-gray-100">
                  <span className="text-xs font-bold text-emerald-600 flex items-center">
                    ✓ Applied to all SQL
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalSqlTableImage(null);
                      setExtractedQuestions(prev => prev.map(q => {
                        const isSql = q.language === "SQL" || q.language === "MySQL" || q.text?.toLowerCase().includes("sql") || q.text?.toLowerCase().includes("table");
                        if (isSql && q.imageUrl === globalSqlTableImage) {
                          return { ...q, imageUrl: null };
                        }
                        return q;
                      }));
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 px-2 py-0.5 rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block border border-dashed border-blue-300 rounded-xl p-4 bg-white hover:bg-blue-50/60 transition shadow-sm">
                <svg className="w-8 h-8 text-blue-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-xs font-bold text-blue-600 block">Click to Select Table Screenshot</span>
                <span className="text-[11px] text-gray-400">PNG, JPG, or WEBP</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSqlTableUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Questions Table */}
      <div className="mt-12">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-bold text-gray-900">Extracted Questions</h2>
          <div className="flex space-x-3">
            <button 
              onClick={() => {
                setEditIndex(null);
                setNewQType("CODING");
                setNewQText("");
                setNewQCorrect("");
                setNewQOptions("");
                setNewQImage(null);
                setShowAddModal(true);
              }}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              + Add Manually
            </button>
            {extractedQuestions.length > 0 && (
              <button 
                onClick={() => setShowSaveModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Create Assessment ({extractedQuestions.length})
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question Text</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correct Answer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {extractedQuestions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No questions yet. Upload a document to extract questions using AI.
                  </td>
                </tr>
              ) : (
                extractedQuestions.map((q, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {q.type}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium mb-1 whitespace-pre-wrap">{q.text}</div>
                      {q.imageUrl && (
                        <div className="my-2 flex items-center space-x-2 bg-blue-50 border border-blue-200 p-1.5 rounded-lg w-fit">
                          <img src={q.imageUrl} alt="Table diagram" className="h-10 w-auto rounded border bg-white object-contain" />
                          <span className="text-xs font-bold text-blue-700 pr-1">📷 Table / Diagram Attached</span>
                        </div>
                      )}
                      {q.options && q.options.length > 0 && (
                        <ul className="list-disc pl-5 text-gray-500 space-y-1">
                          {q.options.map((opt: string, i: number) => (
                            <li key={i}>{opt}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {q.marks}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600 max-w-xs truncate">
                      {q.correctAnswer}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium space-x-2">
                      <button onClick={() => openEditModal(idx)} className="text-blue-600 hover:text-blue-900">Edit</button>
                      <button onClick={() => deleteQuestion(idx)} className="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Create Assessment</h2>
            <p className="text-gray-600 mb-6">Convert these {extractedQuestions.length} questions into a live assessment.</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Assessment Title</label>
                <input 
                  type="text" 
                  value={assessmentTitle}
                  onChange={(e) => setAssessmentTitle(e.target.value)}
                  placeholder="e.g. Midterm Exam - Python"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Duration (Minutes)</label>
                <input 
                  type="number" 
                  value={assessmentDuration}
                  onChange={(e) => setAssessmentDuration(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={saveAssessment}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Create Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Add Question</h2>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Type</label>
                  <select 
                    value={newQType}
                    onChange={(e) => setNewQType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="CODING">Coding</option>
                    <option value="MCQ">MCQ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Marks</label>
                  <input 
                    type="number" 
                    value={newQMarks}
                    onChange={(e) => setNewQMarks(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Question Text</label>
                <textarea 
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  rows={3}
                ></textarea>
              </div>

              {newQType === "MCQ" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Options (Comma separated)</label>
                  <input 
                    type="text" 
                    value={newQOptions}
                    onChange={(e) => setNewQOptions(e.target.value)}
                    placeholder="e.g. A) Option 1, B) Option 2"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Language</label>
                  <select 
                    value={newQLanguage}
                    onChange={(e) => setNewQLanguage(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Python">Python</option>
                    <option value="Java">Java</option>
                    <option value="SQL">SQL</option>
                    <option value="MySQL">MySQL</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="C++">C++</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Reference Table / Schema Picture (Optional for SQL / Questions)
                </label>
                <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50 flex flex-col items-center justify-center">
                  {newQImage ? (
                    <div className="w-full text-center">
                      <img src={newQImage} alt="Table preview" className="max-h-48 mx-auto rounded border bg-white shadow-sm mb-2 object-contain" />
                      <button
                        type="button"
                        onClick={() => setNewQImage(null)}
                        className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 border border-red-200 px-3 py-1 rounded"
                      >
                        ✕ Remove Picture
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-center w-full py-2 hover:bg-gray-100/70 rounded transition">
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
                          reader.onload = () => setNewQImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  {newQType === "MCQ" ? "Correct Answer (e.g. 'A')" : "Reference Solution (for AI Grader)"}
                </label>
                <textarea 
                  value={newQCorrect}
                  onChange={(e) => setNewQCorrect(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
                  rows={3}
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddQuestion}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {editIndex !== null ? "Save Changes" : "Add Question"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
