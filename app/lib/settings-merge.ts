type Settings = Record<string, any>;

/**
 * Merge submitted project settings over the existing stored settings so keys the
 * form doesn't manage survive the save. This is the fix for the data-loss bug
 * where the Bot Settings action rebuilt `settings` from scratch and wiped
 * unmanaged keys (e.g. notifications.emailOnLead) on every save. The `branding`
 * sub-object is merged too, not replaced.
 */
export function mergeProjectSettings(existing: Settings | null | undefined, incoming: Settings): Settings {
  const base = existing || {};
  const baseBranding = (base.branding as Settings) || {};
  const incomingBranding = (incoming.branding as Settings) || {};
  return {
    ...base,
    ...incoming,
    branding: { ...baseBranding, ...incomingBranding },
  };
}
