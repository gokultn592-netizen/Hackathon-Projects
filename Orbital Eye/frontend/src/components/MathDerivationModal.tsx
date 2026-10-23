import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SatelliteInfo } from './Globe3D';
import WhiteboardDerivation from './WhiteboardDerivation';

interface MathDerivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSat?: SatelliteInfo | null;
}

export default function MathDerivationModal({
  isOpen,
  onClose,
  selectedSat,
}: MathDerivationModalProps) {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9500] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 md:p-6 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <WhiteboardDerivation selectedSat={selectedSat} onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}
