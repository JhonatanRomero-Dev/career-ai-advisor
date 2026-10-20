export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Prepare a small square photo before sending it with the profile. @param {File} file */
export async function prepareProfilePhoto(file) {
  if (!PROFILE_PHOTO_TYPES.includes(file.type)) throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
  if (file.size > MAX_PROFILE_PHOTO_BYTES) throw new Error("A foto deve ter no máximo 5 MB.");
  if (!file.size) throw new Error("Este arquivo está vazio. Escolha outra foto.");

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a foto. Tente outro arquivo."));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = source;
  try { await image.decode(); }
  catch { throw new Error("Não foi possível abrir esta imagem. Escolha outra foto."); }
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
  if (!cropSize || image.naturalWidth * image.naturalHeight > 40_000_000) {
    throw new Error("Esta imagem é grande demais. Escolha uma foto de menor resolução.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(512, cropSize);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a foto neste navegador.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (image.naturalWidth - cropSize) / 2, (image.naturalHeight - cropSize) / 2,
    cropSize, cropSize, 0, 0, canvas.width, canvas.height);
  // Re-encoding drops original metadata and keeps storage and profile responses small.
  const photo = canvas.toDataURL("image/jpeg", 0.85);
  if (photo.length > 400_000) throw new Error("Não foi possível reduzir esta foto. Escolha outra imagem.");
  return photo;
}
