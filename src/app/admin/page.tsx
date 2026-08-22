import { Activity, AlertTriangle, BarChart3, Users } from 'lucide-react'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const summaryCards = [
  {
    title: 'Active merchants',
    description: 'Merchants currently transacting on the platform.',
    icon: BarChart3,
    metric: '-',
  },
  {
    title: 'Platform personnel',
    description: 'Internal users with assigned roles.',
    icon: Users,
    metric: '-',
  },
  {
    title: 'Alerts',
    description: 'Open issues that need review.',
    icon: AlertTriangle,
    metric: '-',
  },
  {
    title: "Today's activity",
    description: 'Sign-ins, approvals, and escalations.',
    icon: Activity,
    metric: '-',
  },
]

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          High-level overview and quick links for super admins.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="gap-0">
              <CardHeader className="gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{card.title}</CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </div>
                  </div>
                  <span className="text-xl font-semibold tabular-nums">{card.metric}</span>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

