/** A QR code's dark modules as one SVG path: a rectangle per run along each row. */
export function qrPath(modules: boolean[][]): string {
  let path = ''
  modules.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) {
        x++
        continue
      }
      const start = x
      while (x < row.length && row[x]) x++
      path += `M${start} ${y}h${x - start}v1h${start - x}z`
    }
  })
  return path
}
