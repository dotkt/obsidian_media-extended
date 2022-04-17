import { useAppDispatch, useAppSelector } from "@player/hooks";
import { gotScreenshot, selectScreenshotRequested } from "@slice/action";
import { createPlayer, destroyPlayer } from "@slice/html5";
import { setRatio } from "@slice/interface";
import { useMemoizedFn } from "ahooks";
import { captureScreenshot } from "mx-lib";
import React, { RefCallback, useCallback, useRef } from "react";

import { useApplyTimeFragment, useTimeFragmentEvents } from "../hooks/fragment";
import useGetTimestamp from "../hooks/get-timestamp";
import {
  useApplyPlaybackRate,
  useApplyVolume,
  useStateEventHanlders,
} from "../hooks/media-props";
import { useApplyUserSeek } from "../hooks/user-seek";
import { EventHandler, EventHandlers, useEventHandler } from "./event";
import {
  useApplyPaused,
  useError,
  useProgress,
  useSeeking,
  useUpdateBuffer,
  useUpdateSeekState,
} from "./media-props";
import { useLoadSources } from "./sources";
import { useSubscribe } from "./utils";
import { useWebmFixes } from "./webm-fix";

const useActions = (
  ref: React.MutableRefObject<HTMLMediaElement | null>,
): void => {
  useApplyTimeFragment(useSubscribe, ref);
  useApplyPlaybackRate(useSubscribe, ref);
  useApplyVolume(useSubscribe, ref);
  useApplyUserSeek(useSubscribe, ref);
  useApplyPaused(ref);
  useUpdateBuffer(ref);
  useUpdateSeekState(ref);
  useLoadSources(ref);
};

const useCaptureScreenshot = (
  ref: React.MutableRefObject<HTMLMediaElement | null>,
) => {
  useSubscribe(
    selectScreenshotRequested,
    async ([req], dispatch, media) => {
      if (!req) return;
      let buffer: ArrayBuffer | undefined;
      if (media.instance instanceof HTMLVideoElement) {
        const blob = await captureScreenshot(media.instance);
        buffer = await blob?.arrayBuffer();
      } else {
        console.error("trying to capture screenshot on non-video element");
      }
      dispatch(gotScreenshot(buffer));
    },
    { immediate: true, ref },
  );
};
const useUpdateRatio = () => {
  const dispatch = useAppDispatch();
  return {
    onLoadedMetadata: useMemoizedFn<EventHandler>((event) => {
      const { videoWidth, videoHeight } = event.instance as HTMLVideoElement;
      if (videoHeight && videoWidth) {
        dispatch(setRatio([videoWidth, videoHeight]));
      }
    }),
  };
};

const useEvents = (): EventHandlers<HTMLVideoElement | HTMLAudioElement> => {
  const { onPlay: restrictTimeOnPlay, onTimeUpdate: restrictTimeOnTimeUpdate } =
      useTimeFragmentEvents(),
    { onLoadedMetadata: webmFix } = useWebmFixes(),
    { onProgress, onCanPlay } = useProgress(),
    { onError } = useError(),
    { onSeeked, onSeeking } = useSeeking(),
    {
      onDurationChange,
      onEnded,
      onPause,
      onPlay: setPlayState,
      onRateChange,
      onTimeUpdate: setCurrentTimeState,
      onVolumeChange,
      onWaiting,
    } = useStateEventHanlders();

  const { onLoadedMetadata: setRatio } = useUpdateRatio();

  return {
    onRateChange: useEventHandler(onRateChange),
    onPlay: useEventHandler(setPlayState, restrictTimeOnPlay),
    onPause: useEventHandler(onPause),
    onTimeUpdate: useEventHandler(
      setCurrentTimeState,
      restrictTimeOnTimeUpdate,
    ),
    onCanPlay: useEventHandler(onCanPlay),
    onVolumeChange: useEventHandler(onVolumeChange),
    onDurationChange: useEventHandler(onDurationChange),
    onLoadedMetadata: useEventHandler(webmFix, setRatio),
    onSeeked: useEventHandler(onSeeked),
    onSeeking: useEventHandler(onSeeking),
    onWaiting: useEventHandler(onWaiting),
    onProgress: useEventHandler(onProgress),
    onEnded: useEventHandler(onEnded),
    onError: useEventHandler(onError),
  };
};

const useRefCallback = (
  ref: React.MutableRefObject<HTMLMediaElement | null>,
): RefCallback<HTMLMediaElement | null> => {
  const dispatch = useAppDispatch();
  return useCallback(
    (el) => {
      ref.current = el;
      if (el) {
        dispatch(createPlayer());
      } else {
        dispatch(destroyPlayer());
      }
    },
    [dispatch, ref],
  );
};

const HTMLPlayer = () => {
  const source = useAppSelector((state) => state.provider.source),
    tracks = useAppSelector((state) => state.provider.tracks);

  const autoPlay = useAppSelector((state) => state.controls.autoplay),
    loop = useAppSelector((state) => state.controls.loop),
    controls = useAppSelector((state) => state.interface.controls === "native");

  const refObj = useRef<HTMLMediaElement | null>(null),
    ref = useRefCallback(refObj);

  useActions(refObj);
  useCaptureScreenshot(refObj);
  useGetTimestamp(refObj, useSubscribe);

  const props = {
    ref,
    loop,
    // preload: "auto",
    autoPlay,
    controls,
    ...useEvents(),
  };
  let player;
  if (source) {
    const children = (
      <>
        <source src={source.src} />
        {tracks.map((p) => (
          <track key={p.src} {...p} />
        ))}
      </>
    );
    if (source.playerType === "video" || source.playerType === "unknown") {
      player = <video {...props}>{children}</video>;
    } else if (source.playerType === "audio") {
      player = <audio {...props}>{children}</audio>;
    }
  }
  return player ?? null;
};
export default HTMLPlayer;
