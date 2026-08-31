// Color tokens for Initiative 7, ported from the approved mockup -- every value resolves
// through the CSS custom properties in src/app/inventory/theme.css, so light/dark is a
// single class flip (spares-ai's existing next-themes toggle) and no component here needs
// theme-aware logic.

export const COLORS = {
  bg: "var(--i7-bg)",
  card: "var(--i7-card)",
  primary: "var(--i7-primary)",
  primaryLight: "var(--i7-primary-light)",
  accent: "var(--i7-accent)",
  accentLight: "var(--i7-accent-light)",
  warning: "var(--i7-warning)",
  warningLight: "var(--i7-warning-light)",
  warningBorder: "var(--i7-warning-border)",
  warningTextStrong: "var(--i7-warning-text-strong)",
  danger: "var(--i7-danger)",
  dangerLight: "var(--i7-danger-light)",
  coral: "var(--i7-coral)",
  coralLight: "var(--i7-coral-light)",
  coralBorder: "var(--i7-coral-border)",
  purple: "var(--i7-purple)",
  purpleLight: "var(--i7-purple-light)",
  border: "var(--i7-border)",
  text: "var(--i7-text)",
  textMuted: "var(--i7-text-muted)",
  textLight: "var(--i7-text-light)",
  tableHeaderBg: "var(--i7-table-header-bg)",
  chipBg: "var(--i7-chip-bg)",
  impactBg: "var(--i7-impact-bg)",
  overlay: "var(--i7-overlay)",
  shadow: "var(--i7-shadow)",
  mutedBg: "var(--i7-muted-bg)",
  graySolid: "var(--i7-gray-solid)",
  grayText: "var(--i7-gray-text)",
} as const;

export type ColorTone = "primary" | "success" | "warning" | "danger" | "coral" | "purple" | "gray";

export const colorMap: Record<ColorTone, { bg: string; text: string; solid: string }> = {
  primary: { bg: COLORS.primaryLight, text: COLORS.primary, solid: COLORS.primary },
  success: { bg: COLORS.accentLight, text: COLORS.accent, solid: COLORS.accent },
  warning: { bg: COLORS.warningLight, text: COLORS.warning, solid: COLORS.warning },
  danger: { bg: COLORS.dangerLight, text: COLORS.danger, solid: COLORS.danger },
  coral: { bg: COLORS.coralLight, text: COLORS.coral, solid: COLORS.coral },
  purple: { bg: COLORS.purpleLight, text: COLORS.purple, solid: COLORS.purple },
  gray: { bg: COLORS.mutedBg, text: COLORS.grayText, solid: COLORS.graySolid },
};

/** criticality (real values) -> mockup's A/B/C display convention. Z-factors match
 * config.ts's ILLUSTRATIVE_Z_FACTORS exactly (2.05 / 1.65 / 1.28). */
export const CRIT_LABEL: Record<string, string> = {
  CRITICAL: "A -- Critical",
  HIGH: "B -- Important",
  MEDIUM: "C -- Standard",
};
export const CRIT_SHORT: Record<string, string> = { CRITICAL: "A", HIGH: "B", MEDIUM: "C" };
export const CRIT_COLOR: Record<string, ColorTone> = { CRITICAL: "danger", HIGH: "warning", MEDIUM: "primary" };
export const CRIT_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };

export const DEMAND_DISPLAY: Record<string, string> = {
  Smooth: "Stable",
  Erratic: "Variable",
  Intermittent: "Occasional",
  Lumpy: "Unpredictable",
  OAR: "New / No History",
  NotStockManaged: "Not stocked",
};
export const DEMAND_COLOR: Record<string, ColorTone> = {
  Smooth: "primary",
  Erratic: "warning",
  Intermittent: "coral",
  Lumpy: "danger",
  OAR: "gray",
  NotStockManaged: "gray",
};

export const RISK_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, NotApplicable: 4 };
export const RISK_META: Record<string, { color: ColorTone; dot: string }> = {
  Critical: { color: "danger", dot: COLORS.danger },
  High: { color: "coral", dot: COLORS.coral },
  Medium: { color: "warning", dot: COLORS.warning },
  Low: { color: "success", dot: COLORS.accent },
  NotApplicable: { color: "gray", dot: COLORS.graySolid },
};

/** Color tone per ApprovalStatus (see lib/inventory/approvals.ts for the labels --
 * STATUS_DISPLAY lives there as the single source of truth for the text). Adjusted gets
 * its own tone, distinct from Approved, per the workflow spec ("visually distinguishable
 * ... not just folded into Approved"). */
export const STATUS_COLOR: Record<string, ColorTone> = {
  NEEDS_REVIEW: "gray",
  IN_APPROVAL: "warning",
  APPROVED: "success",
  ADJUSTED: "purple",
  REJECTED: "danger",
};

export const CONF_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NotApplicable: 3 };
export const CONF_COLOR: Record<string, ColorTone> = { HIGH: "success", MEDIUM: "warning", LOW: "danger", NotApplicable: "gray" };
export const CONF_PCT: Record<string, number> = { HIGH: 92, MEDIUM: 65, LOW: 38, NotApplicable: 0 };
export const CONF_LABEL: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low", NotApplicable: "N/A" };
