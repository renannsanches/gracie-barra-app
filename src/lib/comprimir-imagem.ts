/**
 * Redimensiona uma imagem no browser (lado maior ≤ maxLado) e converte-a para
 * WebP. Só corre no cliente (usa Image, canvas e URL.createObjectURL).
 */
export function comprimirParaWebP(file: File, maxLado = 500, qualidade = 0.8): Promise<Blob> {
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
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(blob);
          else reject(new Error("Falha ao converter imagem"));
        },
        "image/webp",
        qualidade
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = objectUrl;
  });
}
