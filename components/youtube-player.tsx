"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

type Props = {
  videoId: string | null;
  onEnded: () => void;
  autoplay?: boolean;
};

export default function YouTubePlayer({
  videoId,
  onEnded,
  autoplay = true,
}: Props) {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentVideoRef = useRef<string | null>(null);

  const initPlayer = useCallback(() => {
    if (!containerRef.current || !videoId || !window.YT || !window.YT.Player)
      return;

    // Destroy existing player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    playerRef.current = new window.YT.Player("yt-player", {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1,
      },
      events: {
        onStateChange: (event: YT.OnStateChangeEvent) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            onEnded();
          }
        },
      },
    });

    currentVideoRef.current = videoId;
  }, [videoId, onEnded, autoplay]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      initPlayer();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode?.insertBefore(tag, firstScript);

    window.onYouTubeIframeAPIReady = () => {
      initPlayer();
    };
  }, [initPlayer]);

  // Handle video changes
  useEffect(() => {
    if (!videoId || videoId === currentVideoRef.current) return;

    if (
      playerRef.current &&
      typeof playerRef.current.loadVideoById === "function"
    ) {
      playerRef.current.loadVideoById(videoId);
      currentVideoRef.current = videoId;
    } else {
      initPlayer();
    }
  }, [videoId, initPlayer]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
    >
      <div id="yt-player" className="h-full w-full" />
      {!videoId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-zinc-600">Waiting for a song...</p>
        </div>
      )}
    </div>
  );
}
