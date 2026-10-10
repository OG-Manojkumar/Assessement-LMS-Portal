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

      setExtractedQuestions(data.questions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddQuestion = () => {
    if (!newQText || !newQCorrect) return alert("Please fill all required fields");
    
    const question = {
      type: newQType,
      text: newQText,
      marks: parseInt(newQMarks),
      correctAnswer: newQCorrect,
      language: newQType === "CODING" ? newQLanguage : null,
      options: newQType === "MCQ" ? newQOptions.split(",").map(s => s.trim()).filter(Boolean) : []
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
          questions: extractedQuestions
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
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-500 mt-2">Manage your extracted questions or upload new ones.</p>
        </div>
      </header>

      {/* Upload Zone */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center bg-white hover:bg-gray-50 transition-colors cursor-pointer relative">
        <input 
          type="file" 
          accept=".docx,.pdf,.odt" 
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        <div className="pointer-events-none">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-4 flex text-sm text-gray-600 justify-center">
            <span className="font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
              {isUploading ? "Extracting Questions using AI..." : "Upload a file"}
            </span>
            <span className="pl-1">or drag and drop</span>
          </p>
          <p className="text-xs text-gray-500 mt-2">DOCX, PDF, or ODT up to 10MB</p>
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
                      <div className="font-medium mb-1">{q.text}</div>
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
                    <option value="MySQL">MySQL</option>
                  </select>
                </div>
              )}

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
