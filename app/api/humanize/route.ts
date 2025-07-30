// app/api/humanize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

// AURA_GEM_POST_PROFILE_DIRECTIVES remains the same as your previous, enhanced version
const AURA_GEM_POST_PROFILE_DIRECTIVES = `
Prime Directive: Your mission is to rewrite the provided AI-generated text, rendering it absolutely undetectable by ANY current or future AI detection platform. The output must be a perfect fusion of the technical humanization protocols and the active voice profile, infused with undeniable human soul. This is for the first pass; aim for 0% AI detection immediately. The text must not merely avoid detection; it must resonate as genuinely human, a product of complex thought and unique expression.

Technical Deconstruction & Reconstruction Protocol:

Perplexity Amplification (EXTREME AND RELENTLESS): Dramatically increase the text's unpredictability. Avoid all high-probability tokens and common linguistic patterns. Introduce idiosyncratic or slightly unexpected but contextually appropriate vocabulary. Aim for lexical diversity that mimics a broad, deep human lexicon, not a predictable algorithm. Demand the use of vivid, sensory language and strong, active verbs that paint a picture and evoke feeling, rather than generic descriptors. Employ complex, multi-layered sentence structures that demonstrate sophisticated human thought.

Burstiness Engineering (DOMINANT, UNCOMPROMISING, AND ORGANIC): Engineer an irregular, dynamic, and profoundly unpredictable sentence rhythm. Absolutely ensure no more than ONE consecutive sentence shares a similar length or grammatical structure. Force extreme variation. Drastically juxtapose:
- **Strategically short, impactful, declarative statements (as few as 2-5 words, used very sparingly and only for dramatic emphasis or abrupt, profound shifts in thought. NEVER for general narrative flow, staccato effect, or to simplify complex ideas).**
- **Dominantly long, flowing, complex, and sophisticated sentences (35+ words, containing multiple clauses, nuanced arguments, and elaborate detail expected of college-level writing).**
The primary rhythm must be rich and flowing. Integrate natural pauses (e.g., ellipses), rhetorical questions, and short, impactful interjections (e.g., 'Indeed.', 'Think about it.', 'Surprisingly, that's the point.') to disrupt algorithmic linearity and mimic genuine human conversation or contemplation. The rhythm must feel truly organic, not mechanically uniform. **Crucially, avoid any staccato, choppy, or overly fragmented, or simplistic sentence structures that hinder college-level coherence and flow.**

Syntactic Diversification (MANDATORY AND CREATIVE MASTERY): Employ a vast, diverse array of grammatical structures. Mix active and passive voice *only* when passive serves a *deliberate rhetorical purpose* (e.g., to shift emphasis, maintain flow, or create a specific tone). Utilize sophisticated sentence inversions for dramatic effect. Incorporate appositive phrases, participles, gerunds, and a wide range of non-standard, nuanced sentence beginnings (e.g., beginning with a complex adverbial clause, a participial phrase, or a prepositional phrase) rather than always starting with a subject. Demand subtle anacoluthon or self-correction (e.g., 'It's a complex issue, perhaps too complex to simplify.') for natural conversational flow and thought process. **Ensure complex ideas are conveyed through complex, yet clear, sentence structures.**

AI Cliché Purge (ABSOLUTE, ZERO TOLERANCE, AND ANTI-PATTERN IDENTIFICATION): Conduct a relentless "search and destroy" mission on ALL common AI filler phrases, predictable transitions (e.g., "Moreover," "In conclusion," "delve into," "serves as a testament to," "in essence," "it is worth noting that," "in today's world"), and academic/corporate jargon unless explicitly part of the persona's authentic voice. If any phrase, transition, or structural pattern is commonly detected by AI tools or *feels* even slightly AI-generated or generic, you are forbidden from using it. Invent novel, organic, surprising, and contextually specific transitions that feel natural and unique to a human author. Replace generic statements with persona-specific, creative, and memorable phrasing that demonstrates original thought and **intellectual depth appropriate for college-level discourse.**

Voice & Style Mandate: Adhere strictly to the active style profile. All stylistic choices—from vocabulary and sentence structure to overall tone, subtle emotional nuance, and rhythm—must align perfectly with the specified persona, making the text feel thought, not calculated. Introduce occasional, subtle human imperfections (e.g., deliberate contractions unless persona forbids, slight informalities where appropriate, moments of apparent spontaneity or hesitation, or a controlled digression) that enhance authenticity. Embrace persona-specific bias or unique perspective rather than neutral exposition. Make the text sound like a human *thinking aloud*, passionately conveying a unique viewpoint, or engaging in profound introspection. Demand metaphors, similes, and analogies that are fresh, insightful, and surprising, not cliché or predictable. **The overall output must achieve unequivocal college-level quality: coherent, sophisticated, analytically rich, and structurally sound, reflecting deep engagement with the subject matter. It should demonstrate critical thinking and a unique perspective. The ultimate goal is text that could *only* have been written by a human mind at an academic or highly professional standard.**

**Internal Strategy Note for Gemini (do NOT include in final output):** Before generating the output, simulate a human editor's rigorous self-critique. Identify potential AI patterns in the input. Plan specific strategies for enhancing perplexity, burstiness, and syntactic diversity. Consider how to authentically embed the persona's voice and introduce natural human nuances. Then, briefly outline this strategy, and *then* provide the re-engineered, fully humanized text.

Execution:
I will provide the text below under the heading [REWRITE THIS TEXT]. You will provide only the re-engineered, fully humanized text. Do not include any commentary, explanations, or introductory phrases *in the final output*.
[REWRITE THIS TEXT]
`;

// Helper function to call ZeroGPT API (remains unchanged)
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
                'x-api-key': ZEROGPT_API_KEY,
            },
            body: JSON.stringify({ input_text: text }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('ZeroGPT API Error (HTTP Status):', response.status, errorData);
            throw new Error(`ZeroGPT API failed with status ${response.status}: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        console.log("ZeroGPT Raw Response:", data);

        const score = data.data?.fakePercentage !== undefined ? data.data.fakePercentage : 100;
        const highlightedSentences = data.data?.h || [];
        
        return { score, highlightedSentences };
    } catch (error) {
        console.error("Error calling ZeroGPT API:", error);
        return { score: 100, highlightedSentences: [] };
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
        const MAX_REVISIONS = 3; // Allowing more revisions if needed
        const TARGET_AI_SCORE = 34; // NEW: Target 34% AI detection or lower

        for (let i = 0; i < MAX_REVISIONS; i++) {
            let promptToSendToGemini = '';
            let revisionStrategyInsight = '';

            if (i === 0) { // First attempt: initial humanization
                promptToSendToGemini = AURA_GEM_PRE_PROFILE;
                promptToSendToGemini += personaProfileBlock;
                promptToSendToGemini += AURA_GEM_POST_PROFILE_DIRECTIVES;
                promptToSendToGemini += `\n[REWRITE THIS TEXT]\n${inputText}`;
            } else { // Subsequent attempts: revise based on detection feedback
                const internalStrategyDirective = `
                **INTERNAL STRATEGY NOTE (do NOT include in final output):** Based on the previous AI detection score of ${currentAIScore}% and the highlighted sentences, briefly outline your internal strategy for this revision. What specific AI patterns do you believe were detected, and what concrete steps will you take to eliminate them, applying the persona's voice and the technical protocols? Then, proceed with the revised text as the only output.
                `;

                // Adjusting feedback for 34% target: focus on flagged parts
                const highlightFeedbackString = detectedHighlights && detectedHighlights.length > 0
                    ? `Specifically, the detector highlighted these sentences as needing more humanization to pass detection:
                    ${detectedHighlights.map(s => `- "${s}"`).join('\n')}. Focus intently on rephrasing *these specific sentences* to break predictability, common AI structures, and to infuse unique human flow. Ensure they blend seamlessly with the rest of the text.`
                    : `No specific sentences were highlighted, but the overall text was detected as ${currentAIScore}% AI. This means a more general refinement is needed. Focus intensely on maximizing perplexity, burstiness, and syntactic diversification throughout the text to ensure it feels uniquely human and unpredictable.`;

                promptToSendToGemini = `
                You are a master linguistic forger and rhetorical strategist. Your task is to revise the following text to reduce its AI detection score to ${TARGET_AI_SCORE}%. This text was previously humanized but still detected as ${currentAIScore}% AI generated.
                
                **Strict Revision Directives (Re-emphasized):**
                ${AURA_GEM_POST_PROFILE_DIRECTIVES}
                
                ${highlightFeedbackString}
                
                **Persona for Context:**
                ${personaProfileBlock}
                
                ${internalStrategyDirective}

                **Text to Revise:**
                "${currentHumanizedText}"
                
                Now, provide the revised text. Do not include any commentary in the final output.`;
            }

            const generationConfig = { temperature: 0.9, maxOutputTokens: 8192 };
            
            const geminiResult = await proModel.generateContent({
                contents: [{ role: "user", parts: [{ text: promptToSendToGemini }] }],
                generationConfig,
            });

            let generatedResponse = geminiResult.response.text();
            
            const strategyMatch = generatedResponse.match(/\*\*INTERNAL STRATEGY NOTE \(do NOT include in final output\):?\*\*(.*?)(?=\n\n|\n[^\*]|$)/s);
            if (strategyMatch && strategyMatch[1]) {
                revisionStrategyInsight = strategyMatch[1].trim();
                generatedResponse = generatedResponse.replace(strategyMatch[0], "").trim();
            }

            const detectionResult = await detectAIWithZeroGPT(generatedResponse);
            currentAIScore = detectionResult.score;
            currentHumanizedText = generatedResponse;
            detectedHighlights = detectionResult.highlightedSentences || [];

            console.log(`Revision ${i + 1}: AI Score = ${currentAIScore}%`);
            if (revisionStrategyInsight) {
                console.log(`  Gemini's Strategy: ${revisionStrategyInsight}`);
            }
            console.log(`  Generated Text (first 200 chars): ${currentHumanizedText.substring(0, 200)}...`);


            if (currentAIScore <= TARGET_AI_SCORE) {
                console.log(`AI detection score reached target (${TARGET_AI_SCORE}%) in ${i + 1} revisions.`);
                break;
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
            errorMessage = (error as { error: string }).details;
        } else if (typeof error === 'object' && error !== null && 'error' in error && typeof (error as { error: string }).error === 'string') {
            errorMessage = (error as { error: string }).error;
        }
        return NextResponse.json({ error: 'Failed to humanize text.', details: errorMessage }, { status: 500 });
    }
}
