export const mapTransitions = {
  "mystery-lake": [{ x: 1933, y: 4230, target: "forlorn-muskeg" }, { x: 667, y: 4160, target: "mountain-town" }, { x: 3823, y: 1202, target: "winding-river-&-carter-hydro-dam" }, { x: 3980, y: 1427, target: "ravine" }],
  "forlorn-muskeg": [{ x: 2974, y: 1646, target: "mystery-lake" }, { x: 176, y: 2037, target: "broken-railroad" }, { x: 701, y: 923, target: "mountain-town" }, { x: 2399, y: 3329, target: "bleak-inlet" }],
  ravine: [{ x: 104, y: 916, target: "mystery-lake" }, { x: 1210, y: 1120, target: "bleak-inlet" }, { x: 2088, y: 894, target: "coastal-highway" }],
  "winding-river-&-carter-hydro-dam": [{ x: 1806, y: 2987, target: "mystery-lake" }, { x: 2699, y: 1655, target: "mystery-lake" }, { x: 3194, y: 593, target: "pleasant-valley" }],
  "pleasant-valley": [{ x: 1159, y: 3798, target: "winding-river-&-carter-hydro-dam" }, { x: 4307, y: 3783, target: "coastal-highway" }, { x: 3928, y: 51, target: "timberwolf-mountain" }, { x: 229, y: 2105, targets: ["keepers-pass", "blackrock"] }],
  "coastal-highway": [{ x: 321, y: 271, target: "ravine" }, { x: 2042, y: 58, target: "pleasant-valley" }, { x: 3175, y: 2846, target: "crumbling-highway" }],
  "crumbling-highway": [{ x: 125, y: 895, target: "coastal-highway" }, { x: 1617, y: 722, target: "desolation-point" }],
  "desolation-point": [{ x: 133, y: 976, target: "crumbling-highway" }],
  "bleak-inlet": [{ x: 2336, y: 658, target: "ravine" }, { x: 1601, y: 793, target: "forlorn-muskeg" }],
  "keepers-pass": [{ x: 995, y: 1626, target: "pleasant-valley" }, { x: 1562, y: 364, target: "blackrock" }],
  blackrock: [{ x: 2935, y: 2173, target: "timberwolf-mountain" }, { x: 1326, y: 3251, targets: ["keepers-pass", "pleasant-valley"] }],
  "timberwolf-mountain": [{ x: 272, y: 2539, target: "pleasant-valley" }, { x: 2736, y: 1891, target: "ash-canyon" }, { x: 2561, y: 645, target: "ash-canyon" }, { x: 260, y: 843, target: "blackrock" }],
  "ash-canyon": [{ x: 2801, y: 2971, target: "timberwolf-mountain" }, { x: 1210, y: 2942, target: "timberwolf-mountain" }],
  "mountain-town": [{ x: 313, y: 3319, target: "forlorn-muskeg" }, { x: 2410, y: 2272, target: "mystery-lake" }, { x: 1636, y: 202, target: "hushed-river-valley" }],
  "hushed-river-valley": [{ x: 695, y: 2557, target: "mountain-town" }],
  "broken-railroad": [{ x: 2208, y: 1341, target: "forlorn-muskeg" }, { x: 130, y: 1531, target: "far-range-branch-line" }],
  "far-range-branch-line": [{ x: 2850, y: 331, target: "broken-railroad" }, { x: 156, y: 728, target: "transfer-pass" }],
  "transfer-pass": [{ x: 1500, y: 1878, target: "far-range-branch-line" }, { x: 815, y: 1016, target: "forsaken-airfield" }, { x: 1580, y: 142, target: "zone-of-contamination" }, { x: 568, y: 139, target: "sundered-pass" }],
  "zone-of-contamination": [{ x: 2871, y: 2631, target: "transfer-pass" }, { x: 294, y: 1664, target: "langston-mine" }, { x: 1066, y: 1330, target: "langston-mine" }, { x: 922, y: 1080, target: "langston-mine" }, { x: 1247, y: 2797, targets: ["transition-cave", "forsaken-airfield", "sundered-pass"] }],
  "sundered-pass": [{ x: 1387, y: 4244, target: "transfer-pass" }, { x: 506, y: 2898, targets: ["transition-cave", "forsaken-airfield", "zone-of-contamination"] }],
  "forsaken-airfield": [{ x: 3084, y: 4186, target: "transfer-pass" }, { x: 4463, y: 2045, targets: ["transition-cave", "sundered-pass", "zone-of-contamination"] }],
  "langston-mine": [{ x: -25, y: 974, target: "zone-of-contamination" }, { x: 571, y: 89, target: "zone-of-contamination" }, { x: 1785, y: 1108, target: "zone-of-contamination" }],
  "transition-cave": [{ x: 92, y: 302, target: "forsaken-airfield" }, { x: 969, y: 1784, target: "zone-of-contamination" }, { x: 1407, y: 727, target: "sundered-pass" }]
};

export const TRANSITION_SIZE = 150;
