import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const imageData = formData.get("thumbnail")
  if(!(imageData instanceof File)) {
      throw new BadRequestError("Not a File");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;
  if(imageData.size > MAX_UPLOAD_SIZE) {
      throw new BadRequestError("Max upload size exceeded");
  }
  const fileType: string = imageData.type;
  const fileData: ArrayBuffer = await imageData.arrayBuffer();

  const videoMetaData = getVideo(cfg.db, videoId);

  if(videoMetaData?.userID != userID) {
      throw new UserForbiddenError("Invalid User");
  }

  videoThumbnails.set(videoId, {
      data: fileData,
      mediaType: fileType,
  })

  const thumbnailUrl = `http://localhost:<${cfg.port}>/api/thumbnails/<${videoId}>`;
  videoMetaData.thumbnailURL = thumbnailUrl;
  updateVideo(cfg.db, videoMetaData);



  return respondWithJSON(200, videoMetaData);
}
