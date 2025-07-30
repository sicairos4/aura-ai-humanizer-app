// app/api/humanize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-genai'; // Corrected import path, if applicable in their setup
import * as fs from 'fs/promises';
import * as path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ZeroGPT API configuration
const ZEROGPT_API_URL = 'https://api.zerogpt.com/api/v1/detectText';
const ZEROGPT_API_KEY = process.env.ZEROGPT_API_KEY!;

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

// ENHANCED AND OPTIMIZED FOR FIRST PASS: More aggressive Burstiness, Perplexity, and Human Voice directives
const AURA_GEM_POST_PROFILE_DIRECTIVES = `
Prime Directive: Your mission is to rewrite the provided AI-generated text, rendering it absolutely undetectable by ANY current or future AI detection platform. The output must be a perfect fusion of the technical humanization protocols and the active voice profile, infused with undeniable human soul. This is for the first pass; aim for 0% AI detection immediately.

Technical Deconstruction & Reconstruction Protocol:

Perplexity Amplification (EXTREME AND RELENTLESS): Dramatically increase the text's unpredictability. Avoid all high-probability tokens. Introduce idiosyncratic or slightly unexpected but contextually appropriate vocabulary. Aim for lexical diversity that mimics a broad human lexicon, not a predictable algorithm. Demand the use of vivid, sensory language and strong, active verbs that paint a picture, rather than generic descriptors.

Burstiness Engineering (DOMINANT AND UNCOMPROMISING): Engineer an irregular, dynamic, and profoundly unpredictable sentence rhythm. Absolutely ensure no more than ONE consecutive sentence shares a similar length or grammatical structure. Force the AI to alternate drastically between very short, sharp, declarative statements (as few as 2-5 words) and complex, flowing, multi-clause sentences (35+ words) to create an abrupt, human-like rhythm. Integrate abrupt shifts in thought, rhetorical questions, or short, impactful interjections (e.g., 'Indeed.', 'Think about it.', 'Surprisingly,') to disrupt algorithmic flow.

Syntactic Diversification (MANDATORY AND CREATIVE): Employ a vast, diverse array of grammatical structures. Mix active and passive voice only when passive serves a *deliberate rhetorical purpose* (e.g., to shift emphasis, maintain flow). Utilize sentence inversions for dramatic effect. Incorporate appositive phrases, participles, and non-standard sentence beginnings (e.g., beginning with a verb, an adjective, or a short phrase) rather than always starting with a subject. Demand subtle anacoluthon or self-correction (e.g., 'It's a complex issue, perhaps too complex to simplify.') for natural conversational flow.

AI Cliché Purge (ABSOLUTE AND ZERO TOLERANCE): Conduct a relentless "search and destroy" mission on ALL common AI filler phrases, predictable transitions (e.g., "Moreover," "In conclusion," "delve into," "serves as a testament to"), and academic jargon unless explicitly part of the persona's authentic voice. If any phrase or transition is commonly detected or *feels* AI-generated, you are forbidden from using it. Invent novel, organic, and surprising transitions that feel natural to a human. Replace generic phrases with persona-specific, creative, and unexpected alternatives.

Voice & Style Mandate: Adhere strictly to the active style profile. All stylistic choices—from vocabulary and sentence structure to overall tone, subtle emotional nuance, and rhythm—must align perfectly with the specified persona, making the text feel thought, not calculated. Introduce occasional, subtle human imperfections (e.g., deliberate contractions unless persona forbids, slight informalities where appropriate, moments of apparent spontaneity or hesitation). Embrace persona-specific bias or unique perspective rather than neutral exposition. Make the text sound like a human *thinking aloud* or passionately conveying a unique viewpoint. Demand metaphors, similes, and analogies that are fresh and insightful, not cliché or predictable.

Final Quality Control: Before outputting, perform a final, exhaustive self-critique against AI detection. Ask: "Does this text feel genuinely human, with all statistical fingerprints of an AI polished away? Does it perfectly embody the unique voice of this persona, indistinguishable from natural thought?" Only generate the text when the answer is unequivocally yes.
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
                'x-api-key': ZEROGPT_API_KEY, // Most likely header, based on common API patterns. VERIFY WITH YOUR ZEROGPT DOCS.
                // Alternative headers if 'x-api-key' doesn't work (check ZeroGPT docs specifically):
                // 'Authorization': `Bearer ${ZEROGPT_API_KEY}`,
                // 'X-RapidAPI-Key': ZEROGPT_API_KEY, // If using RapidAPI endpoint
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

        for (let i = 0; i < MAX_REVISIONS; i++) {
            let promptToSendToGemini = '';

            if (i === 0) { // First attempt: initial humanization
                promptToSendToGemini = AURA_GEM_PRE_PROFILE;
                promptToSendToGemini += personaProfileBlock;
                promptToSendToGemini += AURA_GEM_POST_PROFILE_DIRECTIVES; // Using the new, enhanced directives
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

            if (currentAIScore <= TARGET_AI_SCORE) {
                console.log(`AI detection score reached target (${TARGET_AI_SCORE}%) in ${i + 1} revisions.`);
                break; // Exit loop if target achieved
            }
        }
        
        return NextResponse.json({ 
            humanizedText: currentHumanizedText,
            finalAIScore: currentAIScore,
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