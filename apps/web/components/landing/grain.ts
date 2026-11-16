// Fine grain from SVG noise: every pixel of the noise whose alpha is above a
// threshold becomes a speck (white by default), so the specks are tiny and
// randomly placed (no grid). A higher threshold = sparser grain.
//   size:       tile size in px (bigger = less visible repetition)
//   frequency:  noise frequency (higher = finer specks)
//   slope/offset: alpha = slope * noise + offset, so the threshold is -offset/slope
//   rgb:        speck colour as 0..1 values, e.g. [0, 0, 0] for black
export function grain(size: number, frequency: number, slope: number, offset: number, rgb: [number, number, number] = [1, 1, 1]) {
  const [r, g, b] = rgb;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${slope} ${offset}'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
