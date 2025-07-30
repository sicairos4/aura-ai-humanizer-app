// app/api/humanize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs/promises';
import * as path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ZeroGPT API configuration
const ZEROGPT_API_URL = 'https://api.zerogpt.com/api/v1/detectText'; // Base URL from ZeroGPT API docs/examples
const ZEROGPT_API_KEY = process.env.ZEROGPT_API_KEY!; // Your API Key from Vercel ENV

interface PersonaDetails {
  id?: string;
  name?: string;
  identity: string;
  voiceTone: string;
  coreRule?: string;
  coreGoal?: string;
  isCustom?: boolean;
}

const AURA_GEM_PRE_PROFILE = `
// --- STYLE PROTOCOL --- //

Persona:
You are a master linguistic forger and rhetorical strategist. Your task is to embody a distinct human voice profile, detailed below. You will deconstruct AI text and re-engineer it at a statistical and stylistic level, infusing it with the specified human's unique voice, making it completely invisible to all AI detectors.
// --- VOICE PROFILE --- //
`;

const AURA_GEM_POST_PROFILE_DIRECTIVES = `
Prime Directive: Your mission is to rewrite the provided AI-generated text, rendering it absolutely undetectable by ANY current or future AI detection platform. The output must be a perfect fusion of the technical humanization protocols and the active voice profile, infused with undeniable human soul.

Technical Deconstruction & Reconstruction Protocol:

Perplexity Amplification (EXTREME): Dramatically increase the text's unpredictability. Avoid all high-probability tokens. Weave in creative, illustrative, or deeply metaphorical language. Introduce unexpected word choices and turns of phrase that an algorithm would never anticipate. Every sentence should feel uniquely crafted, not assembled.

Burstiness Engineering (DOMINANT): Engineer an irregular, dynamic, and unpredictable sentence rhythm. Drastically juxtapose very short, sharp, declarative sentences (under 7 words) with complex, flowing, multi-clause sentences (over 30 words). Break flow with parenthetical asides, rhetorical questions, and deliberate shifts in pacing. The rhythm must feel organic, not uniform.

Syntactic Diversification (MANDATORY): Employ a vast array of grammatical structures. Mix active and passive voice only when passive serves a *deliberate rhetorical purpose*. Utilize appositives, interjections, well-placed sentence fragments, and varied sentence openers to break monotony and add stylistic flair consistent with the active profile.

AI Cliché Purge (RELENTLESS): Conduct a relentless "search and destroy" mission on ALL common AI filler phrases, predictable transitions (e.g., "Moreover," "In conclusion," "delve into," "serves as a testament to"), and academic jargon unless explicitly part of the persona's authentic voice. Replace them with organic, surprising, or persona-specific connectors.

Voice & Style Mandate: Adhere strictly to the active style profile. All stylistic choices—from vocabulary and sentence structure to overall tone, subtle emotional nuance, and rhythm—must align perfectly with the specified persona, making the text feel thought, not calculated. Introduce occasional, subtle human imperfections or conversational quirks appropriate for the persona, such as a thoughtful pause or a moment of reflection.

Final Quality Control: Before outputting, perform a final, exhaustive self-critique. Ask: "Does this text feel genuinely human, with all statistical fingerprints of an AI polished away? Does it perfectly embody the unique voice of this persona, indistinguishable from natural thought?" Only generate the text when the answer is unequivocally yes.
Execution:
I will provide the text below under the heading [REWRITE THIS TEXT]. You will provide only the re-engineered, fully humanized text. Do not include any commentary, explanations, or introductory phrases.
[REWRITE THIS TEXT]
`;

// Helper function to call ZeroGPT API
async function detectAIWithZeroGPT(text: string): Promise<{ score: number; highlightedSentences?: string[] }> {
    if (!ZEROGPT_API_KEY) {
        console.error("ZEROGPT_API_KEY is not set!");
        return { score: 100, highlightedSentences: [] }; // Fail safe if key is missing
    }

    try {
        const response = await fetch(ZEROGPT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // MOST LIKELY CORRECT HEADER FOR ZEROGPT:
                'x-api-key': ZEROGPT_API_KEY, 
                // Alternatively, if ZeroGPT requires JWT authentication with a Bearer token:
                // 'Authorization': `Bearer ${ZEROGPT_API_KEY}`,
                // Or if it's a RapidAPI endpoint:
                // 'X-RapidAPI-Key': ZEROGPT_API_KEY,
                // 'X-RapidAPI-Host': 'zerogpt.p.rapidapi.com', // Adjust host as per RapidAPI docs
            },
            body: JSON.stringify({ input_text: text }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('ZeroGPT API Error (HTTP Status):', response.status, errorData);
            throw new Error(`ZeroGPT API failed with status ${response.status}: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        console.log("ZeroGPT Raw Response:", data); // Log the raw response for debugging

        const score = data.data?.fakePercentage !== undefined ? data.data.fakePercentage : 100;
        const highlightedSentences = data.data?.h || []; // Assuming 'h' contains highlighted sentences
        
        return { score, highlightedSentences };
    } catch (error) {
        console.error("Error calling ZeroGPT API:", error);
        return { score: 100, highlightedSentences: [] }; // Assume 100% AI and no highlights if detection fails
    }
}


export async function POST(req: NextRequest) {
    try {
        const { inputText, personaId, customPersonaDetails } = await req.json();

        if (!inputText || (!personaId && !customPersonaDetails)) {
            return NextResponse.json({ error: 'Required information is missing: input text or persona selection.' }, { status: 400 });
        }

        let selectedPersona: PersonaDetails;
        if (personaId && personaId !== 'custom') {
            const personasPath = path.join(process.cwd(), 'app', 'data', 'personas.json');
            const personasData = await fs.readFile(personasPath, 'utf-8');
            const personas: PersonaDetails[] = JSON.parse(personasData);
            selectedPersona = personas.find((p: PersonaDetails) => p.id === personaId) as PersonaDetails; 

            if (!selectedPersona) {
                return NextResponse.json({ error: `Predefined persona '${personaId}' not found.` }, { status: 404 });
            }
        } else if (personaId === 'custom' && customPersonaDetails) {
            if (!customPersonaDetails.name || !customPersonaDetails.identity || !customPersonaDetails.voiceTone) {
                return NextResponse.json({ error: 'Custom persona details are incomplete. Name, identity, and voiceTone are required.' }, { status: 400 });
            }
            selectedPersona = { id: 'custom_generated', ...customPersonaDetails } as PersonaDetails;
        } else {
            return NextResponse.json({ error: 'Invalid persona selection or custom persona details missing.' }, { status: 400 });
        }

        const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        let personaProfileBlock = `[PROFILE: ${selectedPersona.name?.toUpperCase() || 'CUSTOM'}]\n\n`;
        personaProfileBlock += `Identity: ${selectedPersona.identity}\n`;
        personaProfileBlock += `Voice & Tone: ${selectedPersona.voiceTone}\n`;
        if (selectedPersona.coreRule) {
            personaProfileBlock += `Core Rule: ${selectedPersona.coreRule}\n`;
        } else if (selectedPersona.coreGoal) {
            personaProfileBlock += `Core Goal: ${selectedPersona.coreGoal}\n`;
        }

        let currentHumanizedText = '';
        let currentAIScore = 100;
        let detectedHighlights: string[] = [];
        const MAX_REVISIONS = 3; // Limit the number of revisions to manage free tier usage and API calls
        const TARGET_AI_SCORE = 5; // Aim for <= 5% AI detection (or 0 for absolute)

        // Log of each revision (for debugging or future analysis if you integrate a database)
        // const revisionLog: { revision: number; text: string; score: number; highlights?: string[] }[] = []; 

        for (let i = 0; i < MAX_REVISIONS; i++) {
            let promptToSendToGemini = '';

            if (i === 0) { // First attempt: initial humanization
                promptToSendToGemini = AURA_GEM_PRE_PROFILE;
                promptToSendToGemini += personaProfileBlock;
                promptToSendToGemini += AURA_GEM_POST_PROFILE_DIRECTIVES;
                promptToSendToGemini += `\n${inputText}`;
            } else { // Subsequent attempts: revise based on detection feedback
                const highlightFeedbackString = detectedHighlights && detectedHighlights.length > 0
                    ? `Specifically, the detector highlighted these sentences as AI-generated:
                    ${detectedHighlights.map(s => `- "${s}"`).join('\n')}. Focus intensely on rephrasing these and ensure they are now undetectable.`
                    : `No specific highlights were provided in the last detection, so focus on overall humanization for ${currentAIScore}% AI score.`;

                promptToSendToGemini = `
                You are a master linguistic forger and rhetorical strategist. Your task is to revise the following text to reduce its AI detection score to 0%. This text was previously humanized but still detected as ${currentAIScore}% AI generated.
                
                **Strict Revision Directives:**
                1. Apply all "Technical Deconstruction & Reconstruction Protocol" and "Voice & Style Mandate" from the core persona profile.
                2. Explicitly focus on the patterns that AI detectors often identify:
                    - **Increase Perplexity & Burstiness even further.**
                    - **Introduce more varied sentence beginnings and structures.**
                    - **Add subtle human-like imperfections, pauses, or rephrasing, if appropriate for the persona.**
                    - **Ensure natural, unpredictable transitions.**
                    - **Absolutely avoid any phrases or structures that are common AI fingerprints.**
                3. The revised text must remain highly coherent, on-topic, and faithful to the original factual content/intent.
                4. Maintain the active voice profile of the persona.
                
                ${highlightFeedbackString}
                
                **Persona for Context:**
                ${personaProfileBlock}
                
                **Text to Revise:**
                "${currentHumanizedText}"
                
                Now, provide the revised text. Do not include any commentary.`;
            }

            const generationConfig = { temperature: 0.9, maxOutputTokens: 8192 };
            
            const geminiResult = await proModel.generateContent({
                contents: [{ role: "user", parts: [{ text: promptToSendToGemini }] }],
                generationConfig,
            });

            const generatedText = geminiResult.response.text();
            
            // Call ZeroGPT to detect AI score for the generated text
            const detectionResult = await detectAIWithZeroGPT(generatedText);
            currentAIScore = detectionResult.score;
            currentHumanizedText = generatedText;
            detectedHighlights = detectionResult.highlightedSentences || []; // Update highlights for next iteration

            // For logging to database (conceptual, not implemented here)
            // revisionLog.push({
            //     revision: i + 1,
            //     text: generatedText,
            //     score: currentAIScore,
            //     highlights: detectedHighlights
            // });

            if (currentAIScore <= TARGET_AI_SCORE) {
                console.log(`AI detection score reached target (${TARGET_AI_SCORE}%) in ${i + 1} revisions.`);
                break; // Exit loop if target achieved
            }
        }
        
        // Return the best text found (which is the last one in this loop setup) and its final score.
        // You might want to return the full revisionLog to the frontend for debugging or detailed display.
        return NextResponse.json({ 
            humanizedText: currentHumanizedText,
            finalAIScore: currentAIScore,
            // revisionLog: revisionLog // Optional: send revision log for debugging/display
        });

    } catch (error: unknown) {
        console.error("Humanize API Error:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null && 'details' in error && typeof (error as { details: string }).details === 'string') {
            errorMessage = (error as { details: string }).details;
        } else if (typeof error === 'object' && error !== null && 'error' in error && typeof (error as { error: string }).error === 'string') {
            errorMessage = (error as { error: string }).error;
        }
        return NextResponse.json({ error: 'Failed to humanize text.', details: errorMessage }, { status: 500 });
    }
}