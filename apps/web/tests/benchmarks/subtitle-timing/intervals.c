/* Benchmark only. Mirrors cueInterval in shared/src/subtitle-sync.ts.
 * The first count pairs hold immutable source milliseconds, the next pairs
 * receive seconds on the media clock. Negative values mark detached cues. */
void intervals(double *pairs, unsigned int count, double scale, double shift,
               double manual, double origin, double duration) {
  double *out = pairs + 2 * count;
  for (unsigned int i = 0; i < count; i++) {
    double start = __builtin_floor(pairs[2 * i] * scale + shift + 0.5);
    double end = __builtin_floor(pairs[2 * i + 1] * scale + shift + 0.5);
    start = (start + manual) / 1000 - origin;
    end = (end + manual) / 1000 - origin;
    if (start < 0) start = 0;
    if (end > duration) end = duration;
    out[2 * i] = end > start ? start : -1;
    out[2 * i + 1] = end > start ? end : -1;
  }
}
