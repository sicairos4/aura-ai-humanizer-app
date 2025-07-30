// app/api/personas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function GET(req: NextRequest) {
  try {
    // IMPORTANT: Adjust this path if you placed personas.json elsewhere
    const personasPath = path.join(process.cwd(), 'app', 'data', 'personas.json');
    const personasData = await fs.readFile(personasPath, 'utf-8');
    const personas = JSON.parse(personasData);
    return NextResponse.json(personas);
  } catch (error) {
    console.error("Error serving personas:", error);
    return NextResponse.json({ error: 'Failed to load personas.' }, { status: 500 });
  }
}