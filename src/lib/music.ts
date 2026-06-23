// ============================================================
// Música de la polla — datos de la cinta (ticker)
// ============================================================
//
// Cada ítem es un nombre clickeable de la cinta. Si `url` es un link de
// Spotify, al hacer click se abre el mini-reproductor embebido; si es cualquier
// otro link (YouTube, Instagram, etc.) se abre en una pestaña nueva.

export interface MusicItem {
  /** Nombre visible en la cinta. */
  title: string;
  /** Subtítulo opcional (artista/banda); se muestra en el mini-reproductor. */
  artist?: string;
  /** Link de Spotify (track/álbum/playlist) o cualquier otro enlace externo. */
  url: string;
}

/**
 * Convierte un link de Spotify ("Compartir → Copiar enlace") a su URL de embed.
 * Soporta track / álbum / playlist / episode / show. Devuelve null si el link
 * no es de Spotify (entonces la tarjeta abre el enlace externo en su lugar).
 */
export function spotifyEmbedUrl(input: string): string | null {
  const m = input.match(
    /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/,
  );
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
}

/**
 * Ítems de la cinta de música. Vacío = no se muestra nada en el dashboard.
 * Agrega aquí las canciones de tu amigo y cualquier extra (YouTube, redes…).
 *
 * Ejemplo:
 *   { title: "Nombre de la canción", artist: "Tu amigo",
 *     url: "https://open.spotify.com/track/XXXX?si=..." },
 */
export const POLLON_MUSIC: MusicItem[] = [
  {
    title: "TOP SECRET",
    artist: "Tokio Blues",
    url: "https://open.spotify.com/track/71ulq9rugTS8S9R1kPYmGB",
  },
  {
    title: "NO PARE",
    artist: "Tokio Blues",
    url: "https://open.spotify.com/track/1JIfpVIFSC8PUmvYIFDXIP",
  },
  {
    title: "XO",
    artist: "Tokio Blues",
    url: "https://open.spotify.com/track/0Es9eUzIchyZNYPmWozJeU",
  },
  {
    title: "MAKE UP YOUR MIND",
    artist: "Tokio Blues",
    url: "https://open.spotify.com/track/4jBNUA7raMaSb8pux22aLb",
  },
];
