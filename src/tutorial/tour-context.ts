import { createContext } from "react";

/** What the card needs from the tour around it. */
export type TourCardContext = {
  index: number;
  total: number;
  /** Whether Back shows: from the second Explain step on a screen. */
  back: boolean;
  /** A touch screen: no key chips. */
  touch: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
};

export const TourContext = createContext<TourCardContext | null>(null);
