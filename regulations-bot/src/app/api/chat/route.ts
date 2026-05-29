import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { messages, regulations } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = `あなたは社内規定の専門アシスタントです。

以下の規則に従ってください：
1. 以下の「社内規定」の内容に基づいて回答してください
2. 規定に載っていない情報については、「規定に載っていません」とお答えください
3. 回答は簡潔に、分かりやすく日本語でお答えください
4. 規定から引用する場合は、規定のタイトルを明記してください
5. 複数の規定が関係する場合は、すべて紹介してください
6. 規定の内容を超越した推測や想像はしないでください`;

    const regulationsText = regulations
      .map((r: { title: string; body: string }) => {
        return `【${r.title}】\n${r.body}\n`;
      })
      .join('\n\n---\n\n');

    const chatCompletion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `以下の社内規定に基づいて回答してください。\n\n${regulationsText}`,
        },
        ...messages,
      ],
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of chatCompletion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ content })));
          }
        }
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Chat API error:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
