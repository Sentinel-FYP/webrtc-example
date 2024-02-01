import asyncio
import logging
from socketio import AsyncClient
from streamer import VideoStreamer

BASE_URL = "http://localhost:5000"

# FOR STREAMING FROM FILE
# MEDIA_PATH = "video.mp4"
# IS_RTSP_STREAM = False

# FOR CAMERA STREAMING
MEDIA_PATH = "rtsp://:8554/"
IS_RTSP_STREAM = True

streamers = set()

sio = AsyncClient()


@sio.event
async def connect():
    print("socket connected to server")


@sio.event
async def disconnect():
    print("socket disconnected from server")


@sio.on("offer")
async def offer(data):
    streamer = VideoStreamer(media_path=MEDIA_PATH, is_rtsp=IS_RTSP_STREAM)
    streamers.add(streamer)
    answer = await streamer.handle_offer(data)
    await sio.emit(
        "answer",
        answer,
    )


async def connect_sio(sio: AsyncClient):
    try:
        await sio.connect(BASE_URL)
    except Exception:
        print("Socket IO Connection failed")
        exit(-1)


async def shutdown():
    # close peer connections
    await sio.disconnect()
    coros = [streamer.close() for streamer in streamers]
    await asyncio.gather(*coros)
    streamers.clear()


if __name__ == "__main__":
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
