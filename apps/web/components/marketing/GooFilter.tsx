// The SVG filter that makes the three hover blobs merge into one organic
// shape instead of reading as three separate circles. Rendered once per
// page; every .goo button references it by id.
//
// How it works: blur the source heavily, then run a colour matrix that
// pushes alpha way up and subtracts a constant. That turns the soft blurred
// edges into a hard edge, so overlapping blurred circles fuse together.
export function GooFilter() {
  return (
    <svg aria-hidden="true" className="absolute h-0 w-0" focusable="false">
      <defs>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
  );
}
