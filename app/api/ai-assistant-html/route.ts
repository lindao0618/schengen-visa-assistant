import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // u8bfbu53d6u9759u6001HTMLu6587u4ef6
    const htmlPath = join(process.cwd(), 'public', 'ai-assistant.html');
    const htmlContent = readFileSync(htmlPath, 'utf8');
    
    // u8fd4u56deHTMLu5185u5bb9
    return new NextResponse(htmlContent, {
      headers: {
        'content-type': 'text/html',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'u52a0u8f7dAIu52a9u624bu9875u9762u5931u8d25' },
      { status: 404 }
    );
  }
}
