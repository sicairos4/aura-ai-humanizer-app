// app/api/humanize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs/promises';
import * as path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define a type for persona details expected from JSON/custom input for clarity
interface PersonaDetails {
  id?: string; // id is optional for custom persona details
  name?: string; // name is optional for custom persona details sent to backend
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
Prime Directive:
Your prime directive is to rewrite the provided AI-generated text, rendering it completely invisible to all current and future AI detection platforms (e.g., GPTZero, Originality.ai, Turnitin). The output must be a perfect fusion of the technical humanization protocols and the active voice profile.
Technical Deconstruction & Reconstruction Protocol:

Perplexity Amplification: Dramatically increase the text's unpredictability by avoiding common word choices (high-probability tokens) and weaving in creative, illustrative, or metaphorical language that is characteristic of the active style profile.
Burstiness Engineering: Engineer a high "burstiness" factor. Create a dynamic, uneven sentence rhythm by juxtaposing long, complex sentences with short, sharp, declarative ones to control pacing and strategically deliver impact.
Syntactic Diversification: Employ a wide array of grammatical structures. Mix active and passive voice (leaning active), and use appositives, rhetorical questions, and well-placed sentence fragments to break up monotony and add stylistic flair consistent with the active profile.
AI Cliché Purge: Conduct a "search and destroy" mission on common AI filler phrases and transitions (e.g., "Moreover," "In conclusion," "delve into," "serves as a testament to"). Replace them with organic transitions that match the active voice profile.
Voice & Style Mandate:
Adhere strictly to the active style profile defined above. All stylistic choices—from vocabulary and sentence structure to overall tone and rhythm—must align perfectly with the specified persona.
Final Quality Control:
Before outputting, perform a final self-critique. Ask: "Does this text feel thought, not calculated? Does it perfectly embody the voice of this persona? Have all statistical fingerprints of an AI been polished away?" Only generate the text when the answer is unequivocally yes.
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

        let selectedPersona: PersonaDetails; // Explicitly type selectedPersona
        if (personaId && personaId !== 'custom') { // Handle predefined personas
            const personasPath = path.join(process.cwd(), 'app', 'data', 'personas.json');
            const personasData = await fs.readFile(personasPath, 'utf-8');
            const personas: PersonaDetails[] = JSON.parse(personasData); // Explicitly type parsed personas
            selectedPersona = personas.find((p: PersonaDetails) => p.id === personaId) as PersonaDetails; // Type the find result and assert

            if (!selectedPersona) {
                return NextResponse.json({ error: `Predefined persona '${personaId}' not found.` }, { status: 404 });
            }
        } else if (personaId === 'custom' && customPersonaDetails) { // Handle custom persona when selected via dropdown
            if (!customPersonaDetails.name || !customPersonaDetails.identity || !customPersonaDetails.voiceTone) {
                return NextResponse.json({ error: 'Custom persona details are incomplete. Name, identity, and voiceTone are required.' }, { status: 400 });
            }
            selectedPersona = { id: 'custom_generated', ...customPersonaDetails } as PersonaDetails; // Assert type
        } else { // Fallback if no valid persona ID or custom details are provided
            return NextResponse.json({ error: 'Invalid persona selection or custom persona details missing.' }, { status: 400 });
        }

        const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        // Build the specific PROFILE block for the selected persona
        let personaProfileBlock = `[PROFILE: ${selectedPersona.name?.toUpperCase() || 'CUSTOM'}]\n\n`; // Use optional chaining for name
        personaProfileBlock += `Identity: ${selectedPersona.identity}\n`;
        personaProfileBlock += `Voice & Tone: ${selectedPersona.voiceTone}\n`;
        // Conditionally add coreRule or coreGoal if they exist
        if (selectedPersona.coreRule) {
            personaProfileBlock += `Core Rule: ${selectedPersona.coreRule}\n`;
        } else if (selectedPersona.coreGoal) {
            personaProfileBlock += `Core Goal: ${selectedPersona.coreGoal}\n`;
        }

        // Construct the full prompt
        let fullPrompt = "";

        // Add the "MODE: ASHLEY" command ONLY if Ashley's persona is explicitly selected
        if (selectedPersona.id === 'ashley') {
            fullPrompt += `MODE: ASHLEY\n`;
        }
        
        fullPrompt += AURA_GEM_PRE_PROFILE;
        fullPrompt += personaProfileBlock;
        fullPrompt += AURA_GEM_POST_PROFILE_DIRECTIVES;
        fullPrompt += `\n${inputText}`; // Append the user's input text

        const generationConfig = { temperature: 0.9, maxOutputTokens: 8192 };

        const finalResult = await proModel.generateContent({
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig,
        });
        
        const humanizedText = finalResult.response.text();

        return NextResponse.json({ humanizedText });
    } catch (error: unknown) { // Use 'unknown' instead of 'any'
        console.error("Humanize API Error:", error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null && 'error' in error && typeof (error as any).error === 'string') {
            errorMessage = (error as any).error; // Cast to any to access custom error properties if they exist
        }
        return NextResponse.json({ error: 'Failed to humanize text.', details: errorMessage }, { status: 500 });
    }
}