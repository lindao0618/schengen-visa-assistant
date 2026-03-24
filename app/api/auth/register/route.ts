// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db"; // Use the shared Prisma client
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password } = body;

    if (!email || !password) {
      return new NextResponse("Email and password are required", { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return new NextResponse("User with this email already exists", { status: 409 }); // 409 Conflict
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email,
        name, // Name is optional in Prisma schema
        password: hashedPassword,
      },
    });

    // Don't return the password in the response
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(userWithoutPassword, { status: 201 }); // 201 Created
  } catch (error: any) { // Explicitly type error as 'any' or 'unknown' for broader property access
    console.error("--- REGISTRATION_ERROR_DETAILS ---");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Error Name:", error?.name);
    console.error("Error Message:", error?.message);
    console.error("Error Stack:", error?.stack);
    // Attempt to serialize the error object if it's complex
    try {
      console.error("Full Error Object (JSON):", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch (e) {
      console.error("Full Error Object (raw):", error);
      console.error("Could not stringify the full error object.");
    }
    console.error("--- END_REGISTRATION_ERROR_DETAILS ---");

    if (error instanceof SyntaxError) {
        return new NextResponse("Invalid request body", { status: 400 });
    }
    // For other errors, return a generic 500
    return new NextResponse("An internal error occurred during registration", { status: 500 });
  }
}
