export function cropTo16x9(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const targetAspect = 16 / 9
      const srcAspect = img.width / img.height
      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height

      if (srcAspect > targetAspect) {
        sw = Math.round(img.height * targetAspect)
        sx = Math.round((img.width - sw) / 2)
      } else {
        sh = Math.round(img.width / targetAspect)
        sy = Math.round((img.height - sh) / 2)
      }

      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1280, 720)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}
