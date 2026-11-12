const num = (n) => String(Math.round(n * 100) / 100);
const clamp = (width) => (Number.isFinite(width) ? Math.max(14, width) : 14);
export function underlinePath(width) {
    const w = clamp(width);
    return `M1 5C${num(w * 0.25)} 2 ${num(w * 0.5)} 8 ${num(w * 0.72)} 4S${num(w - 5)} 6 ${num(w - 1)} 3`;
}
export function drawUnderline(svg, width) {
    const w = clamp(width);
    svg.setAttribute('width', num(w));
    const path = svg.querySelector('path');
    if (!path)
        return;
    path.setAttribute('pathLength', '1');
    path.setAttribute('d', underlinePath(w));
}
