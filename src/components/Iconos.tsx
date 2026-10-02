// Íconos SVG propios (sin librerías)
export const Pulso = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <path d="M3 17h6.5l3-7.5 4 14 3-6.5H29" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Check = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
    <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Trazo de electrocardiograma que se dibuja una vez al cargar */
export const TrazoECG = () => (
  <svg className="ecg" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden>
    <path d="M0 55 H90 l10-8 10 8 H160 l8 6 14-50 16 72 12-28 H300 l10-8 10 8 H370 l8 6 14-50 16 72 12-28 H520 l10-8 10 8 H600" />
  </svg>
);
