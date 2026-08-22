import { Link } from '@/components/ui/link'
import { getAdminPersonnel } from '@/lib/queries'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

// Optimized date formatting - only format what we need
function formatDate(value: Date | string | null) {
  if (!value) return '-'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value: Date | string | null) {
  if (!value) return '-'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getInitials(fullName: string | null) {
  if (!fullName) return '?'
  return fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default async function AdminPersonnelPage() {
  const personnel = await getAdminPersonnel()

  // Format dates in Server Component
  const formattedPersonnel = personnel.map((person) => ({
    ...person,
    createdAtFormatted: formatDate(person.createdAt),
    lastLoginAtFormatted: formatDateTime(person.lastLoginAt),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Personnel</h1>
          <p className="text-muted-foreground">
            View and manage platform personnel. Click a person to open details.
          </p>
        </div>
      </div>

      <div className="w-full p-4">
        <div className="mb-2 w-full flex-grow border-b-[1px] border-accent1 text-sm font-semibold text-black">
          {personnel.length.toLocaleString()} {personnel.length === 1 ? 'person' : 'people'}
        </div>
        <div className="flex flex-row flex-wrap justify-center gap-4 border-b-2 py-4 sm:justify-start">
          {formattedPersonnel.map((person) => (
            <Link
              prefetch={true}
              key={person.userId}
              className="flex w-[240px] flex-col items-start rounded-lg border p-4 hover:bg-accent2 transition-colors"
              href={`/admin/personnel/${person.userId}`}
            >
              <div className="flex items-center gap-3 mb-3 w-full">
                {person.user?.avatarUrl ? (
                  <Image
                    src={person.user.avatarUrl}
                    alt={person.user?.fullName ?? 'Personnel'}
                    className="h-12 w-12 rounded-full border object-cover"
                    width={48}
                    height={48}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted text-sm font-medium">
                    {getInitials(person.user?.fullName ?? null)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base truncate">
                    {person.user?.fullName ?? 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {person.user?.email ?? '-'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2 w-full">
                <Badge
                  variant={person.isActive ? 'default' : 'secondary'}
                  className="text-xs capitalize"
                >
                  {person.role.replace('_', ' ')}
                </Badge>
                {person.department && (
                  <Badge variant="outline" className="text-xs">
                    {person.department}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground space-y-1 w-full">
                <div>Status: {person.isActive ? 'Active' : 'Inactive'}</div>
                <div>Added: {person.createdAtFormatted}</div>
                {person.lastLoginAtFormatted !== '-' && (
                  <div>Last login: {person.lastLoginAtFormatted}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
