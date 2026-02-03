import { writeFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { v4 as uuidv4 } from 'uuid';
import { updateRecipe, addRecipeImage } from '../db/queries';

const IMAGES_DIR = 'recipe-images';

/**
 * Attach an image to a recipe
 *
 * @param recipeId - Recipe ID to attach image to
 * @param imageData - Image data as Uint8Array
 * @param filename - Original filename
 * @param kind - Image type (hero, step, gallery)
 * @returns The internal image URI
 */
export async function attachImage(
  recipeId: string,
  imageData: Uint8Array,
  filename: string,
  kind: 'hero' | 'step' | 'gallery' = 'hero'
): Promise<string> {
  // Ensure images directory exists
  try {
    await mkdir(IMAGES_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // Directory may already exist
  }

  // Generate unique filename
  const ext = filename.split('.').pop() || 'jpg';
  const uniqueFilename = `${recipeId}-${kind}-${uuidv4()}.${ext}`;
  const path = `${IMAGES_DIR}/${uniqueFilename}`;

  // Write image file
  await writeFile(path, imageData, { baseDir: BaseDirectory.AppData });

  // Create internal URI
  const imageUri = `appdata://${path}`;

  // Add to recipe_images table
  await addRecipeImage(recipeId, path, kind);

  // If this is a hero image, update the recipe's imageUri
  if (kind === 'hero') {
    await updateRecipe(recipeId, { imageUri });
  }

  return imageUri;
}

/**
 * Attach image from a File object (from drag & drop or file input)
 */
export async function attachImageFromFile(
  recipeId: string,
  file: File,
  kind: 'hero' | 'step' | 'gallery' = 'hero'
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const imageData = new Uint8Array(arrayBuffer);
  return attachImage(recipeId, imageData, file.name, kind);
}

/**
 * Attach image from a URL (downloads and saves locally)
 */
export async function attachImageFromUrl(
  recipeId: string,
  url: string,
  kind: 'hero' | 'step' | 'gallery' = 'hero'
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const imageData = new Uint8Array(arrayBuffer);

  // Extract filename from URL or use a default
  const urlPath = new URL(url).pathname;
  const filename = urlPath.split('/').pop() || 'image.jpg';

  return attachImage(recipeId, imageData, filename, kind);
}

/**
 * Check if a string is a valid image URL
 */
export function isImageUrl(str: string): boolean {
  if (!str) return false;

  try {
    const url = new URL(str);
    const ext = url.pathname.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
  } catch {
    return false;
  }
}

/**
 * Check if a string is an internal app data URI
 */
export function isAppDataUri(str: string): boolean {
  return str?.startsWith('appdata://');
}

/**
 * Convert app data URI to a usable URL for display
 * In Tauri, this would be converted to an asset protocol URL
 */
export function resolveImageUri(uri: string): string {
  if (!uri) return '';

  if (isAppDataUri(uri)) {
    // Convert appdata:// to Tauri asset protocol
    const path = uri.replace('appdata://', '');
    return `asset://localhost/${path}`;
  }

  return uri;
}
