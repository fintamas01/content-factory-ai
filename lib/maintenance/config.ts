export function isMaintenanceGateEnabled(): boolean {
  const secret = process.env.MAINTENANCE_SESSION_SECRET?.trim();
  const user = process.env.MAINTENANCE_USERNAME?.trim();
  const pass = process.env.MAINTENANCE_PASSWORD;
  return Boolean(
    secret &&
      user &&
      pass !== undefined &&
      String(pass).length > 0
  );
}
