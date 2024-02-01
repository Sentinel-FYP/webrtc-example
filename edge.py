import argparse
import asyncio
import logging
import os
import platform
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaPlayer, MediaRelay
from aiortc.rtcrtpsender import RTCRtpSender
import socketio

ROOT = os.path.dirname(__file__)
BASE_URL = "http://localhost:5000"
PLAY_VIDEO_FILE = False
CAMERA_NAME = "HP Wide Vision HD Camera"


def create_local_tracks(play_from, decode):
    global relay, webcam

    if play_from:
        player = MediaPlayer(play_from, decode=decode)
        return player.audio, player.video
    else:
        options = {"framerate": "30", "video_size": "640x480"}
        if relay is None:
            if platform.system() == "Darwin":
                webcam = MediaPlayer(
                    "default:none", format="avfoundation", options=options
                )
            elif platform.system() == "Windows":
                webcam = MediaPlayer(
                    f"video={CAMERA_NAME}", format="dshow", options=options
                )
            else:
                webcam = MediaPlayer("/dev/video0", format="v4l2", options=options)
            relay = MediaRelay()
        return None, relay.subscribe(webcam.video)


def force_codec(pc: RTCPeerConnection, sender, forced_codec):
    kind = forced_codec.split("/")[0]
    codecs = RTCRtpSender.getCapabilities(kind).codecs
    transceiver = next(t for t in pc.getTransceivers() if t.sender == sender)
    transceiver.setCodecPreferences(
        [codec for codec in codecs if codec.mimeType == forced_codec]
    )


relay: MediaRelay = None
webcam: MediaPlayer = None
sio = socketio.AsyncClient()


@sio.event
async def connect():
    print("socket connected to server")


@sio.event
async def message(data):
    print("Message from server:", data)


@sio.event
async def disconnect():
    print("socket disconnected from server")


@sio.on("offer")
async def offer(data):
    print("offer received", data)
    offer = RTCSessionDescription(sdp=data["sdp"], type=data["type"])

    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("Connection state is %s" % pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    # open media source
    audio, video = create_local_tracks(
        args.play_from, decode=not args.play_without_decoding
    )

    if audio:
        audio_sender = pc.addTrack(audio)
        if args.audio_codec:
            force_codec(pc, audio_sender, args.audio_codec)
        elif args.play_without_decoding:
            raise Exception("You must specify the audio codec using --audio-codec")

    if video:
        video_sender = pc.addTrack(video)
        if args.video_codec:
            force_codec(pc, video_sender, args.video_codec)
        elif args.play_without_decoding:
            raise Exception("You must specify the video codec using --video-codec")

    await pc.setRemoteDescription(offer)

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await sio.emit(
        "answer",
        {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type},
    )


pcs = set()


async def connect_sio(sio):
    try:
        await sio.connect(BASE_URL)
    except Exception:
        print("Socket IO Connection failed")
        exit(-1)


async def shutdown():
    # close peer connections
    await sio.disconnect()
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    if webcam:
        webcam.video.stop()
    pcs.clear()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WebRTC webcam demo")
    parser.add_argument(
        "--play-from",
        default="video.mp4" if PLAY_VIDEO_FILE else "",
        help="Read the media from a file and sent it.",
    )
    parser.add_argument(
        "--play-without-decoding",
        help=(
            "Read the media without decoding it (experimental). "
            "For now it only works with an MPEGTS container with only H.264 video."
        ),
        action="store_true",
    )
    parser.add_argument(
        "--port", type=int, default=6000, help="Port for HTTP server (default: 5000)"
    )
    parser.add_argument("--verbose", "-v", action="count")
    parser.add_argument(
        "--audio-codec", help="Force a specific audio codec (e.g. audio/opus)"
    )
    parser.add_argument(
        "--video-codec", help="Force a specific video codec (e.g. video/H264)"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(connect_sio(sio))
        loop.run_forever()
    except KeyboardInterrupt:
        print("Keyboard Interrupt, exiting")
        pass
    finally:
        loop.run_until_complete(shutdown())

        exit(0)
