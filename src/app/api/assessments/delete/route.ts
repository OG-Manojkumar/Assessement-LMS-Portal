import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) return NextResponse.json({ error: "Missing assessment ID" }, { status: 400 });

    // Delete dependent records first to satisfy foreign key constraints
    await prisma.assessmentResult.deleteMany({ where: { assessmentId: id } });
    await prisma.question.deleteMany({ where: { assessmentId: id } });
    await prisma.student.deleteMany({ where: { assessmentId: id } });

    // Finally delete the assessment
    await prisma.assessment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete assessment:", error);
    return NextResponse.json({ error: "Failed to delete assessment" }, { status: 500 });
  }
}
