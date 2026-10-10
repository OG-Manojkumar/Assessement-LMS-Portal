import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) return NextResponse.json({ error: "Missing result ID" }, { status: 400 });

    const result = await prisma.assessmentResult.findUnique({ where: { id } });
    if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 });

    // Delete the assessment result
    await prisma.assessmentResult.delete({ where: { id } });
    
    // Check if the student has any other results left (in case of duplicates)
    const remainingResults = await prisma.assessmentResult.count({
      where: { studentId: result.studentId }
    });

    if (remainingResults === 0) {
      // Safe to delete the student profile now
      await prisma.student.delete({ where: { id: result.studentId } });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete student record:", error);
    return NextResponse.json({ error: "Failed to delete student record" }, { status: 500 });
  }
}
