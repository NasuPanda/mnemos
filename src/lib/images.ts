import type { ImageDto } from "../../worker/contract";

/** Images are served from R2 through the Worker, behind the login. */
export const imageUrl = (image: ImageDto) => `/img/${image.key}`;

/** Alt text and zoom label: "Problem image 1", "Answer image 2". There are no captions. */
export const imageLabel = (image: ImageDto) =>
  `${image.side === "problem" ? "Problem" : "Answer"} image ${image.position}`;
