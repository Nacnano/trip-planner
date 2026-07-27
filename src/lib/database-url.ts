const localFallbackUrl = "postgresql://localhost:5432/trip_planner";

export function getDatabaseUrl() {
  return (
    process.env.SUPABASE_DATABASE_URL ??
    process.env.DATABASE_URL ??
    localFallbackUrl
  );
}
