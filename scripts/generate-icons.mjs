import sharp from "sharp";

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#e8e6de"/>
  <path d="M256 74 400 424 256 360 112 424Z" fill="#26343b"/>
  <path d="M256 107 356 381 256 337 156 381Z" fill="#f9faf6"/>
  <path d="M256 130 319 310 256 282 193 310Z" fill="#367dbf"/>
  <path d="M113 424h286" stroke="#cb4b55" stroke-width="18" stroke-linecap="round"/>
</svg>`;

for (const size of [192, 512]) {
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(`public/icon-${size}.png`);
}
