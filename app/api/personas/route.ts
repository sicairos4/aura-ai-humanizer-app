// app/api/personas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function GET(req: NextRequest) { // Removed 'req' unused warning by keeping it, or could remove it if truly not needed.
  try {
    const personasPath = path.join(process.cwd(), 'app', 'data', 'personas.json');
    const personasData = await fs.readFile(personasPath, 'utf-8');
    const personas = JSON.parse(personasData);
    return NextResponse.json(personas);
  } catch (error: unknown) { // Use 'unknown' instead of 'any'
    console.error("Error serving personas:", error);
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Failed to load personas.', details: errorMessage }, { status: 500 });
  }
}