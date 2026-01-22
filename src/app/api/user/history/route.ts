import { NextResponse } from 'next/server';

const DUBVOICE_BASE_URL = 'https://www.dubvoice.ai/api/v1';

export async function GET(request: Request) {
    try {
        const apiKey = process.env.DUBVOICE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing DubVoice API Key' }, { status: 500 });
        }

        // Fetch tasks history
        const response = await fetch(`${DUBVOICE_BASE_URL}/tts?limit=20`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch history' }, { status: response.status });
        }

        const data = await response.json();
        const tasks = data.tasks || [];

        // Map to our History Item interface
        const history = tasks.map((task: any) => ({
            id: task.task_id,
            text: task.text || 'Voice Generation', // API might not return text in list view, check details
            voiceName: 'Voice', // List might not have voice name, handled in UI or separate fetch
            date: task.created_at,
            duration: task.characters ? `${task.characters} chars` : 'Audio',
            url: task.result,
            status: task.status
        }));

        return NextResponse.json({ history });

    } catch (error) {
        console.error('History API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
