"use client";

import { AlertTriangle, Flame, Mail, Percent, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type LoyaltyInsightsPanelProps = {
  selectedAlert: string | null;
  onSelectAlert: (alertId: string) => void;
  onDismiss: () => void;
  onMarkRead: () => void;
};

export function LoyaltyInsightsPanel({
  selectedAlert,
  onSelectAlert,
  onDismiss,
  onMarkRead,
}: LoyaltyInsightsPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            Live Metrics
            <Badge variant="secondary" className="text-xs">
              Real-time
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Active Sessions</span>
            </div>
            <span className="text-sm font-bold">154</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Tier Upgrades Today</span>
            </div>
            <span className="text-sm font-bold text-primary">23</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">New Members</span>
            </div>
            <span className="text-sm font-bold text-blue-600">78</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            Alerts & Notifications
            <Button variant="link" size="sm" className="h-auto p-0">
              See all
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className="flex cursor-pointer items-start justify-between"
            onClick={() => onSelectAlert("low-tier-engagement")}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className={`h-5 w-5 ${selectedAlert === "low-tier-engagement" ? "text-orange-500" : "text-muted-foreground"}`}
              />
              <div>
                <div className="text-sm font-medium">Low Tier Engagement Alert</div>
                <div className="text-xs text-muted-foreground">
                  Tier: Gold members showing 25% decline in activity
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">2m ago</div>
          </div>
          <Separator />
          <div
            className="flex cursor-pointer items-start justify-between"
            onClick={() => onSelectAlert("reward-performance")}
          >
            <div className="flex items-start gap-2">
              <Percent
                className={`h-5 w-5 ${selectedAlert === "reward-performance" ? "text-orange-500" : "text-muted-foreground"}`}
              />
              <div>
                <div className="text-sm font-medium">Reward Performance Issue</div>
                <div className="text-xs text-muted-foreground">
                  Reward: Wine Pairing redemption rate dropped by 18%
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">5h ago</div>
          </div>
          <Separator />
          <div
            className="flex cursor-pointer items-start justify-between"
            onClick={() => onSelectAlert("upcoming-milestone")}
          >
            <div className="flex items-start gap-2">
              <Target
                className={`h-5 w-5 ${selectedAlert === "upcoming-milestone" ? "text-green-500" : "text-muted-foreground"}`}
              />
              <div>
                <div className="text-sm font-medium">Upcoming Milestone</div>
                <div className="text-xs text-muted-foreground">
                  50 members expected to reach Platinum tier next week
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">1d ago</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button size="sm" onClick={onMarkRead}>
            Mark Read
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
