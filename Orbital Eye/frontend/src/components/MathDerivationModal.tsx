import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import FullScreenWhiteboard from './FullScreenWhiteboard';
import { SatellitePosition } from '../hooks/useSatellitePositions';

interface MathDerivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  satellites: SatellitePosition[];
}

export default function MathDerivationModal({
  isOpen,
  onClose,
  satellites,
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
      className="fixed inset-0 z-[9999] bg-white flex flex-col select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <FullScreenWhiteboard satellites={satellites} onClose={onClose} />
    </div>,
    document.body
  );
}
