export function getAlertStatusMeta(alert) {
  const conf = (alert?.confidence || "").toLowerCase();
  const type = (alert?.type || "").toLowerCase();

  if (conf.includes("confirmed")) {
    return {
      category: "confirmed",
      pill: type.includes("structural")
        ? "STRUCTURAL VIOLATION"
        : "CONFIRMED RULE VIOLATION",
      badgeClass: "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]",
      accentColor: "#DC2626",
    };
  }
  if (conf.includes("suspected")) {
    return {
      category: "suspected",
      pill: type.includes("granularity")
        ? "SUSPECTED GRANULARITY SHIFT"
        : "SUSPECTED SCALE SHIFT",
      badgeClass: "border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]",
      accentColor: "#D97706",
    };
  }
  return {
    category: "uncertain",
    pill: "UNCERTAIN — NEEDS DICTIONARY",
    badgeClass: "border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]",
    accentColor: "#475569",
  };
}
