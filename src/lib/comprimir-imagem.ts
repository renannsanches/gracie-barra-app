/**
 * Compressão de imagens no browser. Só corre no cliente (usa Image, canvas e
 * URL.createObjectURL).
 */

// Desenha a imagem num canvas com o lado maior ≤ maxLado (nunca aumenta)
function desenharRedimensionada(file: File, maxLado: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;

      if (width > maxLado || height > maxLado) {
        if (width >= height) {
          height = Math.round((height / width) * maxLado);
          width = maxLado;
        } else {
          width = Math.round((width / height) * maxLado);
          height = maxLado;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas não suportado"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = objectUrl;
  });
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao converter imagem"))),
      tipo,
      qualidade,
    );
  });
}

/**
 * Redimensiona (lado maior ≤ maxLado) e converte para WebP. Nos browsers que não
 * geram WebP (Safari) o canvas devolve PNG em silêncio — quem precisa de um
 * formato garantido usa comprimirFoto.
 */
export async function comprimirParaWebP(file: File, maxLado = 500, qualidade = 0.8): Promise<Blob> {
  return paraBlob(await desenharRedimensionada(file, maxLado), "image/webp", qualidade);
}

/**
 * Como comprimirParaWebP, mas nunca devolve PNG: se o browser não gerar WebP
 * (o WebKit ignora "image/webp" no toBlob), volta a codificar o mesmo canvas em JPEG.
 * O resultado é sempre image/webp ou image/jpeg.
 */
export async function comprimirFoto(file: File, maxLado: number, qualidade: number): Promise<Blob> {
  const canvas = await desenharRedimensionada(file, maxLado);
  const webp = await paraBlob(canvas, "image/webp", qualidade);
  if (webp.type === "image/webp") return webp;
  return paraBlob(canvas, "image/jpeg", qualidade);
}
