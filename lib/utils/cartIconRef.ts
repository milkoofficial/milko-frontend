/**
 * Global Cart Icon Ref Store
 * Allows access to cart icon elements from anywhere for animation
 */

let cartIconRefs: {
  mobile?: HTMLElement;
  desktop?: HTMLElement;
} = {};

export const cartIconRefStore = {
  setMobile: (element: HTMLElement | null) => {
    if (element) {
      cartIconRefs.mobile = element;
    } else {
      delete cartIconRefs.mobile;
    }
  },
  setDesktop: (element: HTMLElement | null) => {
    if (element) {
      cartIconRefs.desktop = element;
    } else {
      delete cartIconRefs.desktop;
    }
  },
  getMobile: (): HTMLElement | undefined => cartIconRefs.mobile,
  getDesktop: (): HTMLElement | undefined => cartIconRefs.desktop,
  getAny: (): HTMLElement | undefined => cartIconRefs.mobile || cartIconRefs.desktop,
};
