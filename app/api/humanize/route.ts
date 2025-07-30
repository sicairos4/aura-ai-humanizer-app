// app/api/humanize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs/promises';
import * as path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

// ENHANCED: More aggressive Burstiness and Human Voice directives
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

        let fullPrompt = "";

        if (selectedPersona.id === 'ashley') {
            fullPrompt += `MODE: ASHLEY\n`;
        }
        
        fullPrompt += AURA_GEM_PRE_PROFILE;
        fullPrompt += personaProfileBlock;
        fullPrompt += AURA_GEM_POST_PROFILE_DIRECTIVES; // Using the enhanced directives
        fullPrompt += `\n${inputText}`;

        const generationConfig = { temperature: 0.9, maxOutputTokens: 8192 };

        const finalResult = await proModel.generateContent({
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig,
        });
        
        const humanizedText = finalResult.response.text();

        return NextResponse.json({ humanizedText });
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