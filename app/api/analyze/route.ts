// app/api/analyze/route.ts
// This is a dedicated "server" endpoint that only handles analyzing text.
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the AI client, securely accessing the key from your .env.local file.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// This function handles POST requests sent to '/api/analyze'.
export async function POST(req: NextRequest) {
  try {
    const { inputText } = await req.json(); // Get the text that the user sent from the frontend.

    // We use the faster "Flash" model for analysis because speed is important for this feature.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // This is the specialized prompt we send to Gemini. We ask it to return a structured JSON object.
    const prompt = `Analyze the following text for its core writing characteristics. Provide your analysis in a strict JSON format. Do not include any text outside of the JSON object. The JSON object must have these exact keys: "writing_style_name": A creative, descriptive name for the style (e.g., "Cautious Analyst", "Enthusiastic Advocate"); "primary_tone": The dominant tone (e.g., "Formal", "Casual"); "language": The detected language; "scores": An object with scores from 1-100 for "clarity", "confidence", "formality", and "engagement"; "improvement_tips": An array of 3 brief, actionable improvement tips. Here is the text: "${inputText}"`;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();

    // Clean the AI's response to make sure it's perfect JSON before sending it back to the frontend.
    const jsonResponse = rawResponse.replace(/```json\n|```/g, '').trim();
    const analysisData = JSON.parse(jsonResponse);

    return NextResponse.json({ analysisData }); // Send the structured data back to the frontend.
  } catch (error) {
    // If anything goes wrong, log the error on the server and send a helpful message back.
    console.error("Analysis API Error:", error);
    return NextResponse.json({ error: 'Failed to analyze text.' }, { status: 500 });
  }
}