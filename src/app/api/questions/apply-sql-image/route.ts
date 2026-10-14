import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { assessmentId, imageUrl } = await req.json();

    if (!assessmentId) {
      return NextResponse.json({ error: "Missing assessmentId" }, { status: 400 });
    }

    const questions = await prisma.question.findMany({
      where: { assessmentId }
    });

    let updatedCount = 0;
    for (const q of questions) {
      const isSql =
        q.language === "SQL" ||
        q.language === "MySQL" ||
        q.text?.toLowerCase().includes("sql") ||
        q.text?.toLowerCase().includes("table");

      if (isSql) {
        await prisma.question.update({
          where: { id: q.id },
          data: { imageUrl: imageUrl || null }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error("Apply SQL image error:", error);
    return NextResponse.json({ error: error.message || "Failed to apply SQL image" }, { status: 500 });
  }
}
