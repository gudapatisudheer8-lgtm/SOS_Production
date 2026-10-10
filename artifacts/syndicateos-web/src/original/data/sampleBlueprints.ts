// The original shipped illustrative sample plans here. They are replaced with a neutral
// "no plan uploaded" placeholder so no fabricated project drawings appear as real data.
const EMPTY_PLAN =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#FAF9F5"/><text x="400" y="250" font-family="sans-serif" font-size="20" fill="#78716c" text-anchor="middle">No plan document uploaded</text></svg>'
  );
export const SAMPLE_LAYOUT_BLUEPRINT = EMPTY_PLAN;
export const SAMPLE_CONSTRUCTION_BLUEPRINT = EMPTY_PLAN;
