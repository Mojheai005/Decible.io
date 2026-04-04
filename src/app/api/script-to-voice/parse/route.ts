// ===========================================
// DOCUMENT PARSER — Extract text from .docx, .pdf, .txt
// Returns extracted text + chunk plan
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { createClient } from '@/lib/supabase/server';
import { chunkText } from '@/lib/text-chunker';
import { CREDITS_CONFIG } from '@/lib/constants';

export const maxDuration = 30;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
];

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // 2. Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // 3. Validate file
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.txt')) {
            return NextResponse.json({
                error: 'Unsupported file type. Please upload a .docx, .pdf, or .txt file.',
            }, { status: 400 });
        }

        // 4. Extract text based on file type
        let extractedText = '';
        const buffer = Buffer.from(await file.arrayBuffer());

        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
            // DOCX parsing
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
        } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            // PDF parsing using pdf-parse v2 class API (requires Uint8Array)
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { PDFParse: PDFParser } = require('pdf-parse') as { PDFParse: new (buf: Uint8Array) => { load: () => Promise<void>; getText: () => Promise<string>; destroy: () => void } };
            const uint8 = new Uint8Array(buffer);
            const parser = new PDFParser(uint8);
            await parser.load();
            extractedText = await parser.getText();
            parser.destroy();
        } else {
            // Plain text
            extractedText = buffer.toString('utf-8');
        }

        // 5. Validate extracted text
        if (!extractedText || extractedText.trim().length < 10) {
            return NextResponse.json({
                error: 'Could not extract text from file. The file may be empty or contain only images.',
            }, { status: 400 });
        }

        // 6. Generate chunk plan
        const plan = chunkText(extractedText.trim());

        return NextResponse.json({
            success: true,
            text: extractedText.trim(),
            plan: {
                chunks: plan.chunks.map(c => ({
                    index: c.index,
                    wordCount: c.wordCount,
                    charCount: c.charCount,
                    preview: c.text.substring(0, 100) + (c.text.length > 100 ? '...' : ''),
                })),
                totalChunks: plan.chunks.length,
                totalWords: plan.totalWords,
                totalChars: plan.totalChars,
                totalCredits: plan.totalCredits * CREDITS_CONFIG.COST_PER_CHARACTER,
            },
            fileName: file.name,
        });

    } catch (error) {
        console.error('Document parse error:', error);
        return NextResponse.json(
            { error: 'Failed to parse document. Please try a different file.' },
            { status: 500 }
        );
    }
}
