"use client";

import { ScreenHeader } from "@/components/app-shell";
import { captureVideoFrame } from "@/lib/image";
import { useEffect, useRef, useState } from "react";

interface Frame {
  id: string;
  src: string;
  selected: boolean;
  label: string;
}

export function VideoAdd() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [phase, setPhase] = useState<"capture" | "confirm">("capture");

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  function onFile(file?: File) {
    if (!file) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setFrames([]);
    setPhase("capture");
    setTime(0);
  }

  function onLoaded() {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Math.min(video.duration || 20, 20));
  }

  function seek(value: number) {
    setTime(value);
    const video = videoRef.current;
    if (video) video.currentTime = value;
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const src = captureVideoFrame(video);
    if (!src) return;
    setFrames((list) => [
      ...list,
      {
        id: `frame-${Date.now()}-${list.length}`,
        src,
        selected: true,
        label: `Item ${list.length + 1}`,
      },
    ]);
  }

  function discardVideo() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
    if (videoRef.current) videoRef.current.src = "";
  }

  const selectedCount = frames.filter((frame) => frame.selected).length;

  if (phase === "confirm") {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
        <ScreenHeader backHref="/closet" title="Confirm items" />
        <p className="text-[13px] text-black/45">{frames.length} found</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() =>
                setFrames((list) =>
                  list.map((item) => (item.id === frame.id ? { ...item, selected: !item.selected } : item))
                )
              }
              className="text-left"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-[#ececec]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frame.src} alt="" className="size-full object-cover" />
                <span
                  className={`absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] text-white ${
                    frame.selected ? "bg-black" : "border border-black/30 bg-white"
                  }`}
                >
                  {frame.selected ? "✓" : ""}
                </span>
              </div>
              <input
                value={frame.label}
                onChange={(event) =>
                  setFrames((list) =>
                    list.map((item) => (item.id === frame.id ? { ...item, label: event.target.value } : item))
                  )
                }
                className="mt-1 w-full bg-transparent text-[11px] outline-none"
                onClick={(event) => event.stopPropagation()}
              />
            </button>
          ))}
        </div>
        <form action="/closet/save" method="post" className="mt-8 flex gap-2">
          <input type="hidden" name="source" value="video" />
          {frames
            .filter((frame) => frame.selected)
            .map((frame) => (
              <input key={frame.id} type="hidden" name="name" value={frame.label} />
            ))}
          <button
            type="button"
            onClick={() => setFrames((list) => list.filter((item) => !item.selected))}
            className="flex-1 rounded-xl bg-white py-3 text-[13px]"
          >
            Remove
          </button>
          <button
            type="submit"
            className="flex-[2] rounded-xl bg-black py-3 text-[13px] font-medium text-white"
          >
            Add {selectedCount} to closet
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
      <ScreenHeader backHref="/closet" />
      <h1 className="font-serif text-[28px] leading-tight">Pan your rack · up to 20s</h1>
      <p className="mt-2 text-[13px] text-black/45">
        {objectUrl
          ? `${String(Math.floor(time)).padStart(2, "0")}:${String(Math.floor((time % 1) * 60)).padStart(2, "0")} / 00:${String(
              Math.floor(duration) || 20
            ).padStart(2, "0")}`
          : "Upload a short video, then pick stills."}
      </p>
      <div className="relative mt-4 overflow-hidden rounded-3xl bg-black">
        {objectUrl ? (
          <video
            ref={videoRef}
            src={objectUrl}
            className="aspect-[3/4] w-full object-cover"
            onLoadedMetadata={onLoaded}
            playsInline
            muted
          />
        ) : (
          <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center text-white/70">
            <span className="text-[14px]">Upload a rack video</span>
            <input type="file" accept="video/*" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} />
          </label>
        )}
        {objectUrl ? (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-4 opacity-30">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="border border-white/40" />
            ))}
          </div>
        ) : null}
      </div>
      {objectUrl ? (
        <>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={time}
            onChange={(event) => seek(Number(event.target.value))}
            className="mt-4 w-full accent-black"
          />
          <p className="mt-3 text-center text-[13px] text-black/45">One clear item at a time · good light</p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={capture}
              className="flex h-14 flex-1 items-center justify-center rounded-full bg-white text-[14px] font-medium shadow"
            >
              Capture frame
            </button>
            <button
              type="button"
              disabled={frames.length === 0}
              onClick={() => {
                discardVideo();
                setPhase("confirm");
              }}
              className="flex h-14 flex-1 items-center justify-center rounded-xl bg-black text-[14px] font-medium text-white disabled:opacity-40"
            >
              Review {frames.length}
            </button>
          </div>
          <p className="mt-3 text-center text-[12px] text-black/35">Video is discarded after you extract stills.</p>
        </>
      ) : null}
    </div>
  );
}
