import { getDealerTheme as getDealerThemeFromService, type DealerTheme } from '../services/dealerConfig.service';

// Re-export type for backward compatibility
export type { DealerTheme };

// Default theme fallback (used if service hasn't loaded yet)
export const DEFAULT_DEALER_THEME: DealerTheme = {
    primary: "#008060",
    primaryHover: "#006f55",
};

/**
 * Gets the theme configuration for a dealer.
 * This is an async function that fetches from the centralized dealer config service.
 * Use this in async contexts (useEffect, event handlers, etc.)
 */
export async function getDealerTheme(dealerName?: string | null): Promise<DealerTheme> {
    try {
        return await getDealerThemeFromService(dealerName);
    } catch (error) {
        console.error('[dealerTheme] Failed to get dealer theme, using default:', error);
        return DEFAULT_DEALER_THEME;
    }
}

export function applyDealerTheme(theme: DealerTheme): void {
    const root = document.documentElement;
    root.style.setProperty("--primary-color", theme.primary);
    root.style.setProperty("--primary-hover", theme.primaryHover);
    const primaryHsl = hexToHsl(theme.primary);
    if (primaryHsl) {
        root.style.setProperty("--primary", primaryHsl);
        root.style.setProperty("--ring", primaryHsl);
    }
}

function hexToHsl(hex: string): string | null {
    const cleaned = hex.replace("#", "").trim();
    if (cleaned.length !== 6) return null;
    const r = parseInt(cleaned.slice(0, 2), 16) / 255;
    const g = parseInt(cleaned.slice(2, 4), 16) / 255;
    const b = parseInt(cleaned.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
    }

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    const sPct = Math.round(s * 100);
    const lPct = Math.round(l * 100);
    return `${h} ${sPct}% ${lPct}%`;
}
