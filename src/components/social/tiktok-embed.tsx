'use client';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';

export function TikTokEmbed({ url }: { url: string }) {
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOembed = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://www.tiktok.com/oembed?url=${url}`);
        if (!response.ok) {
            throw new Error(`TikTok oEmbed failed with status: ${response.status}`);
        }
        const data = await response.json();
        setEmbedHtml(data.html);
      } catch (error) {
        console.error('Failed to fetch TikTok oEmbed:', error);
        setEmbedHtml('<p class="text-red-500 text-center p-4">Could not load TikTok video. The link may be private or invalid.</p>');
      } finally {
        setLoading(false);
      }
    };

    fetchOembed();
  }, [url]);

  useEffect(() => {
    if (!embedHtml) return;

    // TikTok's embed script needs to be loaded to render the video
    const script = document.createElement('script');
    script.src = 'https://www.tiktok.com/embed.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Clean up the script when the component unmounts
      const existingScript = document.querySelector('script[src="https://www.tiktok.com/embed.js"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, [embedHtml]); // Re-run when embedHtml is set

  if (loading) {
    return <Skeleton className="h-[500px] w-[325px] rounded-lg" />;
  }

  return (
    <div
      className="[&>blockquote]:max-w-[325px] [&>blockquote]:min-w-[325px] [&>blockquote]:max-h-[700px] overflow-auto"
      dangerouslySetInnerHTML={{ __html: embedHtml || '' }}
    />
  );
}
