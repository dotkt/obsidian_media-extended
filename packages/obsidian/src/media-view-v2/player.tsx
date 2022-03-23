import "@vidstack/player/define/vds-audio-player.js";
import "@vidstack/player/define/vds-video-player.js";
import "@vidstack/player/define/vds-media-ui.js";

import type {
  AudioPlayerElement,
  MediaProviderElement,
  MediaUiElement,
  VideoPlayerElement,
} from "@vidstack/player";
import assertNever from "assert-never";
import { parseTF } from "mx-lib";
import { EventRef } from "obsidian";
import React, { useContext } from "preact/compat";
import { useEffect, useMemo, useRef, useState } from "preact/compat";
import { parse as parseQS } from "query-string";

import { InternalMediaInfo } from "../base/media-info";
import { MediaType } from "../base/media-type";
import { is, useFrag, useHashProps } from "./hash-tool";
import { ControlsContext, PlayerContext } from "./misc";
import PlayerControls from "./ui";
import { useIcon } from "./ui/utils";

declare module "preact/src/jsx" {
  namespace JSXInternal {
    interface IntrinsicElements {
      "vds-audio-player": HTMLAttributes<AudioPlayerElement>;
      "vds-video-player": HTMLAttributes<VideoPlayerElement>;
      "vds-media-ui": HTMLAttributes<MediaUiElement>;
    }
  }
}

export const enum ShowControls {
  none,
  native,
  full,
}
interface PlayerProps {
  info: InternalMediaInfo;
  controls?: ShowControls;
  onFocus?: (evt: FocusEvent) => any;
  onBlur?: (evt: FocusEvent) => any;
}

const Player = ({
  info,
  controls = ShowControls.full,
  onFocus,
  onBlur,
}: PlayerProps) => {
  const playerRef = useRef<MediaProviderElement>(null);

  const [mediaInfo, setMediaInfo] = useState(info);

  const { events, inEditor } = useContext(PlayerContext);
  useEffect(() => {
    let refs: EventRef[] = [];
    if (events) {
      if (playerRef.current) {
        events.trigger("player-init", playerRef.current);
      } else {
        events.trigger("player-destroy");
      }
      refs.push(
        events.on("file-loaded", (info) => {
          setMediaInfo(info);
        }),
      );
    }
    return () => {
      events && refs.forEach(events.offref.bind(events));
    };
  }, [events]);

  const timeSpan = useMemo(() => parseTF(mediaInfo.hash), [mediaInfo.hash]);
  const hashQuery = useMemo(() => parseQS(mediaInfo.hash), [mediaInfo.hash]);
  const controlsEnabled = useMemo(() => is(hashQuery, "controls"), [hashQuery]);

  useFrag(timeSpan, playerRef);
  useHashProps(hashQuery, playerRef);
  if (controls === ShowControls.none && controlsEnabled) {
    controls = ShowControls.full;
  }

  const playerProps = useMemo(
      () => ({
        ref: playerRef as any,
        tabIndex: 0,
        src: mediaInfo.resourcePath,
        controls: controls === ShowControls.native,
        onFocus,
        onBlur,
      }),
      // update only when vault path changed
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [mediaInfo.src, controls, onFocus, onBlur],
    ),
    ui = useMemo(
      () => (
        <ControlsContext.Provider value={{ timeSpan, player: playerRef }}>
          <vds-media-ui slot="ui">
            {controls === ShowControls.full && <PlayerControls />}
          </vds-media-ui>
        </ControlsContext.Provider>
      ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [controls, timeSpan?.start, timeSpan?.end],
    );

  let player;
  switch (mediaInfo.type) {
    case MediaType.Audio:
      player = <vds-audio-player {...playerProps}>{ui}</vds-audio-player>;
      break;
    case MediaType.Video:
    case MediaType.Unknown:
      player = <vds-video-player {...playerProps}>{ui}</vds-video-player>;
      break;
    default:
      assertNever(mediaInfo.type);
  }

  const editBtn = useIcon(["pencil"]);
  return (
    <>
      {player}
      {inEditor && (
        <div
          aria-label="Edit Source Markdown"
          className="edit-block-button"
          role="button"
          ref={editBtn}
        />
      )}
    </>
  );
};
export default Player;
