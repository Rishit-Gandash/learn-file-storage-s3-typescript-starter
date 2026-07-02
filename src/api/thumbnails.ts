import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import { file, type BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";

// type Thumbnail = {
//   data: ArrayBuffer;
//   mediaType: string;
// };
//
//
// export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
//   const { videoId } = req.params as { videoId?: string };
//   if (!videoId) {
//     throw new BadRequestError("Invalid video ID");
//   }
//
//   const video = getVideo(cfg.db, videoId);
//   if (!video) {
//     throw new NotFoundError("Couldn't find video");
//   }
//
//   const thumbnail = videoThumbnails.get(videoId);
//   if (!thumbnail) {
//     throw new NotFoundError("Thumbnail not found");
//   }
//
//   return new Response(thumbnail.data, {
//     headers: {
//       "Content-Type": thumbnail.mediaType,
//       "Cache-Control": "no-store",
//     },
//   });
// }

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const videoMetaData = getVideo(cfg.db, videoId);

  if(videoMetaData?.userID != userID) {
      throw new UserForbiddenError("Invalid User");
  }

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
  if(fileType !== "image/jpeg" && fileType !== "image/png") {
      throw new BadRequestError("Invalid FileType");
  }
  const fileExtension: string | undefined = fileType.split("/").pop()?.toLowerCase();
  if(fileExtension === undefined) {
      throw new Error("FATAL: could not get extention from filetype");
  }


  const fileData: ArrayBuffer = await imageData.arrayBuffer();
  const fileBuffer: Buffer = Buffer.from(fileData); 
  const filePath: string = path.join(cfg.filepathRoot, ".." , `/assets/${videoId}.${fileExtension}`)
  Bun.write(filePath, fileBuffer);
  console.log(`writing to file ${filePath}`);


  const thumbnailUrl: string = `http://localhost:<${cfg.port}>/assets/<${videoId}>.<${fileExtension}>`;
  videoMetaData.thumbnailURL = thumbnailUrl;
  updateVideo(cfg.db, videoMetaData);


  return respondWithJSON(200, videoMetaData);
}
