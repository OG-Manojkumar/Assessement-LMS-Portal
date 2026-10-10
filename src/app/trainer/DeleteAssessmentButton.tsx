"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAssessmentButton({ assessmentId, assessmentTitle }: { assessmentId: string, assessmentTitle: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Are you absolutely sure you want to delete "${assessmentTitle}"? This will erase all questions and student results associated with it permanently.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch("/api/assessments/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assessmentId })
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to delete assessment.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting assessment.");
    }
    setIsDeleting(false);
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={isDeleting}
      className="text-red-500 hover:text-red-700 font-medium text-sm ml-4"
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}
