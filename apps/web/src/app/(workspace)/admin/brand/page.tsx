import { redirect } from 'next/navigation';

/**
 * Duplicate old /admin/brand route is permanently redirected to /settings
 * so that all branding controls live in a single unified source of truth.
 */
export default function LegacyAdminBrandRedirectPage() {
  redirect('/settings');
}

