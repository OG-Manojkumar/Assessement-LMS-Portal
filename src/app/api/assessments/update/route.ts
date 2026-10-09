import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(req: NextRequest) {
  try {
    const { id, title, duration, status } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Assessment ID required" }, { status: 400 });
    }

    const updated = await prisma.assessment.update({
      where: { id },
      data: {
        title,
        duration: parseInt(duration),
        status
      }
    });

    return NextResponse.json({ success: true, assessment: updated });
  } catch (error: any) {
    console.error("Update assessment error:", error);
    return NextResponse.json({ error: "Failed to update assessment" }, { status: 500 });
  }
}
