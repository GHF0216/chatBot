import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const tenant = process.env.SHAREPOINT_TENANT;
    if (!tenant) {
      return NextResponse.json(
        { error: 'SharePoint tenant not configured' },
        { status: 500 }
      );
    }

    // Get the auth token from the request (from Teams SSO or frontend auth)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const listUrl = process.env.SHAREPOINT_LIST_URL || '_api/web/lists/getByTitle(\'Site Pages\')/items';
    const apiUrl = `https://${tenant}.sharepoint.com/${listUrl}`;

    // Fetch items from SharePoint with $select to get all necessary fields
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json;odata=verbose',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SharePoint API error:', response.status, errorText);
      return NextResponse.json(
        { error: `SharePoint API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const items = data.d?.results || data.d || [];

    // Extract text content from each page's HTML body
    const regulations = await Promise.all(
      items.map(async (item: Record<string, unknown>) => {
        const title = (item.Title as string) || '無題';
        const bodyHtml = (item.Body as string) || '';

        // Clean HTML to extract readable text
        const cleanedBody = cleanHtml(bodyHtml);

        return {
          id: item.Id,
          title: title,
          body: cleanedBody,
          serverRedirectedUrl: item.ServerRedirectedUrl,
        };
      })
    );

    return NextResponse.json({ regulations });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('SharePoint API error:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * Remove HTML tags and convert to readable text
 */
function cleanHtml(html: string): string {
  if (!html) return '';

  // Remove script and style elements
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[#\w]+;/g, '');

  // Clean up whitespace
  text = text.replace(/\n+/g, '\n').replace(/ {2,}/g, ' ').trim();

  // Limit to first 1000 characters (enough for most regulation summaries)
  if (text.length > 1000) {
    text = text.substring(0, 1000) + '...';
  }

  return text;
}
