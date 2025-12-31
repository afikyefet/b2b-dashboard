const DEALER_FILTER_KEY = 'b2b-dashboard-dealer-filter';

export const saveSelectedDealer = (dealerName: string | null): void => {
  try {
    if (dealerName === null) {
      localStorage.removeItem(DEALER_FILTER_KEY);
    } else {
      localStorage.setItem(DEALER_FILTER_KEY, dealerName);
    }
  } catch (error) {
    console.error('Failed to save dealer to localStorage:', error);
  }
};

export const loadSelectedDealer = (): string | null => {
  try {
    return localStorage.getItem(DEALER_FILTER_KEY);
  } catch (error) {
    console.error('Failed to load dealer from localStorage:', error);
    return null;
  }
};

export const validateDealerExists = (
  dealerName: string | null,
  availableDealers: string[]
): string | null => {
  if (!dealerName) return null;

  const trimmed = dealerName.trim();
  if (!availableDealers.includes(trimmed)) {
    return null;
  }
  return trimmed;
};
