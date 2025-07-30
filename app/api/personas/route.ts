// app/api/personas/route.ts
import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

// Define Persona interface here for type safety, BEFORE its use
interface Persona {
  id: string;
  name: string;
  identity?: string;
  voiceTone?: string;
  coreRule?: string;
  coreGoal?: string;
  isCustom?: boolean;
}

// Cache variable outside the handler for serverless function to reuse across warm invocations
// FIX: Explicitly type cachedPersonas as Persona[]
let cachedPersonas: Persona[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes in milliseconds (adjust as needed)

export async function GET() { 
  try {
    // Check if cache is valid and less than CACHE_LIFETIME old
    if (cachedPersonas && (Date.now() - cacheTimestamp < CACHE_LIFETIME)) {
      console.log('Serving personas from cache.');
      return NextResponse.json(cachedPersonas);
    }

    const personasPath = path.join(process.cwd(), 'app', 'data', 'personas.json');
    const personasData = await fs.readFile(personasPath, 'utf-8');
    // FIX: Explicitly cast JSON.parse result to Persona[]
    const personas: Persona[] = JSON.parse(personasData); 
    
    // Update cache
    cachedPersonas = personas;
    cacheTimestamp = Date.now();
    console.log('Serving personas from file and updating cache.');

    return NextResponse.json(personas);
  } catch (error: unknown) {
    console.error("Error serving personas:", error);
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Failed to load personas.', details: errorMessage }, { status: 500 });
  }
}