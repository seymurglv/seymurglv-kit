/** True when the user asks for reduced motion. False where `matchMedia` is unavailable. */
export declare function reducedMotion(): boolean;
/** Every intermediate string from `from` to `to`: erase the differing tail, then type the new one. */
export declare function morphSteps(from: string, to: string): string[];
/** Changes the element's text one character per 16 ms. A new call cancels the previous one. */
export declare function morphLabel(el: HTMLElement, to: string): void;
/**
 * Width in px of `text` set in the element's font, measured on a canvas.
 * The element must be attached and styled, so its computed font is the one it is drawn in.
 */
export declare function textWidth(el: HTMLElement, text: string): number;
/** Runs `change` and moves the box's height from the old value to the new one. */
export declare function followHeight(box: HTMLElement, change: () => void): void;
