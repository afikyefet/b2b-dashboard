export type DealerTheme = {
    primary: string;
    primaryHover: string;
};

export const DEFAULT_DEALER_THEME: DealerTheme = {
    primary: "#008060",
    primaryHover: "#006f55",
};

export const DEALER_THEME_MAP: Record<string, DealerTheme> = {
    "primary arms": { primary: "#cf0e2c", primaryHover: "#960D21" },
    "hydrocore concepts llc": { primary: "#8b1201", primaryHover: "#640E02" },
    "aalto group": { primary: "#fd5304", primaryHover: "#C24003" },
    "safety agency, s.r.o.": { primary: "#30363f", primaryHover: "#1F2329" },
    "sas tactical equipements": { primary: "#fe842e", primaryHover: "#C46624" },
    "steinadler": { primary: "#353535", primaryHover: "#292929" },
};

export function normalizeDealerKey(value: string): string {
    return value.trim().toLowerCase();
}

export function getDealerTheme(dealerName?: string | null): DealerTheme {
    if (!dealerName) return DEFAULT_DEALER_THEME;
    return DEALER_THEME_MAP[normalizeDealerKey(dealerName)] ?? DEFAULT_DEALER_THEME;
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
